import { network } from '../core/network.js';
import { createTabEngine } from './engine.tab.js';

export function createOnlineEngine() {
  let serverState = null;
  let cachedPieces = null; // CACHE: Guarda último estado válido das peças
  let cachedPlayers = null; // CACHE: Guarda info dos jogadores
  let cachedInitial = null; // CACHE: Guarda quem é o jogador 'initial'
  let gameId = null;
  let myNick = null;
  let myPassword = null;
  let boardSize = 9; // Tamanho padrão
  let waitingForServer = false; // Indica se estamos aguardando resposta

  // Instância do motor local para validação
  let localValidator = null;
  
  // IMPORTANTE: Usamos 'initial' do servidor, NÃO cores!
  // - Se EU sou 'initial': minhas peças ficam em baixo (linha 3), visão normal
  // - Se EU NÃO sou 'initial': minhas peças DEVEM ficar em baixo, então ROTACIONO 180°
  
  return {
    init(gid, nick, pass, size = 9) {
      gameId = gid;
      myNick = nick;
      myPassword = pass;
      boardSize = size;
      // Reinicia o validador com o tamanho correto
      localValidator = createTabEngine({ columns: size });
      
    },

    update(data) {
      serverState = data;
      waitingForServer = false; // Recebemos resposta do servidor
      
      // Cacheia pieces, players e initial quando servidor as envia
      if (data.pieces) cachedPieces = data.pieces;
      if (data.players) cachedPlayers = data.players;
      if (data.initial) cachedInitial = data.initial;

      // --- SINCRONIZA O VALIDADOR LOCAL (CORRIGIDO) ---
      if (cachedPieces && cachedPlayers && cachedInitial && localValidator) {
        const cols = this.getColumns();
        const logicalBoard = Array.from({ length: 4 }, () => Array(cols).fill(null));
        const logicalPieces = { 1: [], 2: [] };

        cachedPieces.forEach((p, index) => {
          if (!p) return;
          
          const { row, col } = this.indexToCoords(index);
          
          // 🔥 Determina dono baseado na COR da peça (não no índice)
          const initialColor = cachedPlayers[cachedInitial];
          const isInitialPlayer = (p.color === initialColor);
          const logicalPlayerID = isInitialPlayer ? 1 : 2;

          const pieceObj = {
            player: logicalPlayerID,
            hasMoved: p.inMotion,
            hasReachedEnd: p.reachedLastRow,
            row, col
          };

          logicalBoard[row][col] = pieceObj;
          logicalPieces[logicalPlayerID].push(pieceObj);
        });

        // Determina jogador atual lógico
        let currentPlayerLogic = 1;
        if (data.turn && cachedInitial) {
          const turnIsInitial = (data.turn === cachedInitial);
          currentPlayerLogic = turnIsInitial ? 1 : 2;
        }

        // Dado
        const diceVal = data.dice ? data.dice.value : null;

        // 🔥 CORREÇÃO: Injeta estado COMPLETO
        localValidator.overrideState(logicalBoard, logicalPieces, currentPlayerLogic, diceVal);
      }
    },

    // --- GETTERS PARA A UI ---

    getBoard() {
      // Usa cache se servidor não enviar pieces neste update
      const pieces = cachedPieces;
      const initial = cachedInitial || serverState?.initial;
      
      if (!pieces) {
        return Array.from({ length: 4 }, () => Array(boardSize).fill(null));
      }
      
      const cols = this.getColumns();
      const board = Array.from({ length: 4 }, () => Array(cols).fill(null));
      const amIInitial = (initial === myNick);
      
      // Constrói tabuleiro VISUAL
      pieces.forEach((p, index) => {
        if (!p) return;

        // Pega coordenadas lógicas
        let { row, col } = this.indexToCoords(index);
        
        // Transforma para coordenadas VISUAIS (minhas peças sempre em baixo)
        const visualPos = this.transformCoords(row, col);
        
        // CORREÇÃO CRÍTICA AQUI:
        // O GameView só deixa jogar se piece.player === 1.
        // Então, independentemente de quem eu sou (Initial ou Opponent),
        // as MINHAS peças têm de ter ID 1 para a UI.
        
        const pieceOwner = this.getPieceOwner(index); // 'initial' ou 'opponent'
        let visualPlayerID;

        if (amIInitial) {
            // Eu sou Initial. Initial=1 (Eu), Opponent=2 (Inimigo)
            visualPlayerID = (pieceOwner === 'initial') ? 1 : 2;
        } else {
            // Eu sou Opponent. Opponent=1 (Eu), Initial=2 (Inimigo)
            visualPlayerID = (pieceOwner === 'opponent') ? 1 : 2;
        }

        board[visualPos.row][visualPos.col] = {
          player: visualPlayerID,
          hasMoved: p.inMotion,
          hasReachedEnd: p.reachedLastRow,
          row: visualPos.row, 
          col: visualPos.col
        };
      });
      
      return board;
    },
    
    // Helper para transformar coordenadas Lógicas <-> Visuais
    transformCoords(r, c) {
      const cols = this.getColumns();
      
      // 🔥 VALIDAÇÃO CRÍTICA
      if (r < 0 || r > 3 || c < 0 || c >= cols) {
        console.error(`[transformCoords] Coords inválidas: r=${r}, c=${c}, cols=${cols}`);
        return { row: 0, col: 0 }; // Fallback seguro
      }
      
      const initial = cachedInitial || serverState?.initial;
      
      if (!initial) {
        console.warn('[transformCoords] Initial desconhecido, usando coords normais');
        return { row: r, col: c }; // Assume normal se servidor não enviou
      }
      
      const amIInitial = (initial === myNick);

      if (amIInitial) {
        // Sou Player 1 (Initial): Vejo tabuleiro normal (Minhas peças em 3)
        return { row: r, col: c };
      } else {
        // Sou Player 2 (Opponent): Vejo tabuleiro rodado (Minhas peças em 3)
        // Lógica: Row 0 -> Visual 3. Row 3 -> Visual 0.
        const newR = 3 - r;
        const newC = (cols - 1) - c;
        
        // 🔥 VALIDA RESULTADO
        if (newR < 0 || newR > 3 || newC < 0 || newC >= cols) {
          console.error(`[transformCoords] Resultado inválido: (${r},${c}) → (${newR},${newC})`);
          return { row: r, col: c }; // Fallback: retorna original
        }
        
        return { row: newR, col: newC };
      }
    },

    // Helper: Determina dono da peça baseado na cor (CORRIGIDO)
    getPieceOwner(index) {
      const piece = cachedPieces?.[index];
      if (!piece) return null;
      
      const initialColor = cachedPlayers?.[cachedInitial];
      if (!initialColor) return null;
      
      // 🔥 Compara pela COR, não pelo índice
      return (piece.color === initialColor) ? 'initial' : 'opponent';
    },

    getColumns() {
      return boardSize;
    },
    
    getState() {
      return serverState;
    },

    getHighlights() {
      if (!serverState || !serverState.selected) return [];
      
      // Highlights vêm do servidor como índices lógicos
      return serverState.selected.map(idx => {
        let { row, col } = this.indexToCoords(idx);
        
        // Transforma para visual
        return this.transformCoords(row, col);
      });
    },

    getCurrentPlayer() {
      // Para a UI, se for o meu turno, retorna 1 (Eu). Se não, 2.
      return (serverState?.turn === myNick) ? 1 : 2;
    },

    getDice() {
      return serverState?.dice?.value ?? null;
    },
    
    getDiceObj() {
      return serverState?.dice || null;
    },

    canPass() {
      return serverState?.mustPass === myNick || serverState?.mustPass === true;
    },
    
    hasMovablePieces() {
      const pieces = cachedPieces;
      if (!pieces) return false;
      const myColor = cachedPlayers?.[myNick];
      if (!myColor) return false;
      const myPiecesInMotion = pieces.filter(p => p && p.color === myColor && p.inMotion === true).length;
      return myPiecesInMotion > 0;
    },
    // 🔥 Verifica se há movimentos disponíveis (CORRIGIDO)
    hasAnyValidMove() {
      if (!localValidator) return true;
      
      // Verifica se o jogador atual tem pelo menos uma jogada válida
      const selectableCells = localValidator.getSelectableCells();
      
      for (const piece of selectableCells) {
        const moves = localValidator.getValidMoves(piece.row, piece.col);
        if (moves.length > 0) {
          return true;
        }
      }
      
      return false;
    },
    
    // USANDO O VALIDADOR LOCAL (CORRIGIDO)
    getValidMoves(r, c) {
      if (!localValidator) return [];

      // 🔥 VERIFICAÇÃO CRÍTICA: Só permite mover se é a nossa vez E temos dado
      const isMyTurn = (serverState?.turn === myNick);
      const hasDice = serverState?.dice?.value != null;
      
      if (!isMyTurn) {
        console.warn('[Online] getValidMoves: Não é a tua vez');
        return [];
      }
      
      if (!hasDice) {
        console.warn('[Online] getValidMoves: Precisa de lançar o dado primeiro');
        return [];
      }

      // Converte para coordenadas lógicas
      const logicalPos = this.transformCoords(r, c);
      
      // Pede movimentos ao validador
      const validMovesLogical = localValidator.getValidMoves(logicalPos.row, logicalPos.col);
      
      // Converte de volta para visuais
      return validMovesLogical.map(move => {
        return this.transformCoords(move.row, move.col);
      });
    },
    
    // Suporte para hints/AI (opcional, mas bom para consistência)
    getHypotheticalMoves(r, c, dice, player) {
       if (!localValidator) return [];
       const logicalPos = this.transformCoords(r, c);
       const moves = localValidator.getHypotheticalMoves(logicalPos.row, logicalPos.col, dice, player);
       return moves.map(m => this.transformCoords(m.row, m.col));
    },

    // 🔥 NOVO: Contagem de peças para verificação de vitória
    getPieceCounts() {
      if (!cachedPieces) return { player1: 0, player2: 0 };
      
      const board = this.getBoard();
      const cols = this.getColumns();
      
      let player1Count = 0;
      let player2Count = 0;
      
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = board[r][c];
          if (cell) {
            if (cell.player === 1) player1Count++;
            else if (cell.player === 2) player2Count++;
          }
        }
      }
      
      return { player1: player1Count, player2: player2Count };
    },
    
    checkWinner() {
      if (!serverState?.winner) return null;
      return serverState.winner === myNick ? 1 : 2;
    },
    
    isWaitingForServer() {
      return waitingForServer;
    },

    // --- AÇÕES ---

    async rollDice() {
      waitingForServer = true;
      try {
        await network.roll(myNick, myPassword, gameId);
      } finally {}
    },

    // Método para enviar APENAS seleção de peça (raramente usado)
    async selectPiece(r, c) {
      const logicalPos = this.transformCoords(r, c);
      const idx = this.coordsToIndex(logicalPos.row, logicalPos.col);
      
      console.log(`[Online] Selecionando peça: cell=${idx} (visual: ${r},${c})`);
      
      waitingForServer = true;
      try {
        await network.notify(myNick, myPassword, gameId, idx);
      } catch (err) {
        waitingForServer = false;
        throw err;
      }
    },

    // Método principal: Move peça de origem para destino
    async movePiece(fromR, fromC, toR, toC) {
      console.log('=== ENVIANDO JOGADA COMPLETA ===');
      console.log('Estado do Servidor:', {
        turn: serverState?.turn,
        dice: serverState?.dice,
        step: serverState?.step
      });
      
      // Converte AMBAS as coordenadas para lógicas
      const logicalFrom = this.transformCoords(fromR, fromC);
      const logicalTo = this.transformCoords(toR, toC);
      
      const idxFrom = this.coordsToIndex(logicalFrom.row, logicalFrom.col);
      const idxTo = this.coordsToIndex(logicalTo.row, logicalTo.col);
      
      console.log('Origem (visual):', {row: fromR, col: fromC}, '→ lógico:', logicalFrom, '→ índice:', idxFrom);
      console.log('Destino (visual):', {row: toR, col: toC}, '→ lógico:', logicalTo, '→ índice:', idxTo);
      console.log('================================');
      
      waitingForServer = true;
      try {
        // Envia em 2 etapas: primeiro a peça, depois o destino
        await network.notify(myNick, myPassword, gameId, idxTo, idxFrom);
      } catch (err) {
        waitingForServer = false;
        console.error('[Online] Erro ao mover peça:', err);
        throw err;
      }
    },

    // Compatibilidade com código antigo (delega para movePiece)
    async moveSelectedTo(r, c) {
      console.warn('[Online] moveSelectedTo está deprecated, use movePiece');
      throw new Error('Use movePiece(fromR, fromC, toR, toC) em vez de moveSelectedTo');
    },

    async passTurn() {
      await network.pass(myNick, myPassword, gameId);
    },

    async giveUp() {
      if (gameId) {
        await network.leave(myNick, myPassword, gameId);
      }
    },

    // --- UTILITÁRIOS DE COORDENADAS (LÓGICAS) ---
    // Estas funções lidam SEMPRE com a lógica padrão (P1=Row3, P2=Row0)
    
    indexToCoords(index) {
      const cols = this.getColumns();
      let r, c;
      if (index < cols) {
        r = 3; c = index; // P1 Start (Esq->Dir)
      } else if (index < cols * 2) {
        r = 2; c = (cols - 1) - (index - cols); // Dir->Esq
      } else if (index < cols * 3) {
        r = 1; c = index - cols * 2; // Esq->Dir
      } else {
        r = 0; c = (cols - 1) - (index - cols * 3); // P2 Start (Dir->Esq)
      }
      return { row: r, col: c };
    },

    coordsToIndex(r, c) {
      const cols = this.getColumns();
      
      // 🔍 Adiciona validação:
      if (r < 0 || r > 3 || c < 0 || c >= cols) {
        console.error(`[coordsToIndex] Coords inválidas: r=${r}, c=${c}, cols=${cols}`);
        return 0; // Fallback seguro
      }
      
      if (r === 3) return c;                              // Linha 0 lógica
      if (r === 2) return cols + (cols - 1 - c);         // Linha 1 lógica
      if (r === 1) return (2 * cols) + c;                // Linha 2 lógica
      if (r === 0) return (3 * cols) + (cols - 1 - c);   // Linha 3 lógica
      
      console.error(`[coordsToIndex] Linha inesperada: ${r}`);
      return 0;
    },
    
    // Expõe o validador local para uso com AI (dicas)
    getLocalValidator() {
      return localValidator;
    }
  };
}