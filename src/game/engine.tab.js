// Regras completas do Tâb — engine “puro” (sem UI)
// Mantém o tabuleiro 4×N, azuis (player 2) na linha 0 e vermelhos (player 1) na linha 3.
// VERSÃO AVANÇADA (com suporte a IA Hard)

export function createTabEngine(opts = {}) {
  const columns = clampOdd(opts.columns ?? 9, 7, 15);

  // ------- Estado -------
  // ALTERADO: 'let' em vez de 'const' para permitir overrideState
  let board = Array.from({ length: 4 }, (_, r) =>
    Array.from({ length: columns }, (_, c) => null)
  );

  let pieces = { 1: [], 2: [] }; // 1 = vermelho, 2 = azul

  // coloca peças
  for (let c = 0; c < columns; c++) {
    const pBlue = { player: 2, hasMoved: false, hasReachedEnd: false, row: 0, col: c };
    const pRed  = { player: 1, hasMoved: false, hasReachedEnd: false, row: 3, col: c };
    board[0][c] = pBlue; pieces[2].push(pBlue);
    board[3][c] = pRed;  pieces[1].push(pRed);
  }

  let currentPlayer = 1; // vermelho começa
  let dice = null;
  let selected = null;

  // ------- Helpers -------
  function clampOdd(n, min, max) {
    const nn = Math.max(min, Math.min(max, n | 0));
    return nn % 2 === 0 ? nn + 1 : nn;
  }
  
  const dirForRow = (row) => ((row === 1 || row === 3) ? +1 : -1); // 1/3 → direita; 0/2 → esquerda

  const initialRowOf = (player) => (player === 1 ? 3 : 0);
  const lastRowOf    = (player) => (player === 1 ? 0 : 3);

  function cell(r, c) {
    if (r < 0 || r > 3 || c < 0 || c >= columns) return null;
    return board[r][c];
  }
  function setCell(r, c, val) {
    board[r][c] = val;
    if (val) { val.row = r; val.col = c; }
  }
  function samePos(a, b) { return a && b && a.row === b.row && a.col === b.col; }

  function hasOwnOnInitialRow(player) {
    const r0 = initialRowOf(player);
    return pieces[player].some(p => p.row === r0);
  }

  function allPiecesUnmoved(player) {
    return pieces[player].every(p => !p.hasMoved);
  }

  // -------- Dado de paus --------
  function rollDice() {
    const r = Math.random();
    let val = (r < 0.0625) ? 6 : (r < 0.3125) ? 1 : (r < 0.6875) ? 2 : (r < 0.9375) ? 3 : 4;

    if (allPiecesUnmoved(currentPlayer) && (val === 4 || val === 6)) {
      return rollDice(); // Recursão
    }

    dice = val;
    return dice;
  }

  // Movimentação (regra oficial) 
  function getValidMovesFrom(piece, moves) {
    if (!moves || moves <= 0) return [];
    const player = piece.player;
    const start = { row: piece.row, col: piece.col };
    const initialRow = initialRowOf(player);
    const lastRow = lastRowOf(player);

    // A regra "Início do movimento" aplica-se a CADA PEÇA
    if (!piece.hasMoved && moves !== 1) {
        return [];
    }

    // REGRA IMPORTANTE: Peça NA última linha só se move se não houver peças na inicial
    if (start.row === lastRow && hasOwnOnInitialRow(player)) {
      return [];
    }

    const results = new Set();
    const key = (p) => `${p.row},${p.col}`;

    function stepFrom(pos) {
      const { row, col } = pos;
      const dir = dirForRow(row); // +1 (direita) para 1,3; -1 (esquerda) para 0,2
      const nextCol = col + dir;

      // 1. Movimento dentro da linha
      if (nextCol >= 0 && nextCol < columns) {
        return [{ row, col: nextCol }];
      }

      // 2. Transições de extremidade (Absolutas)
      const C_FIM = columns - 1;
      const C_INI = 0;

      // Percurso J1
      if (row === 3 && col === C_FIM) return [{ row: 2, col: C_FIM }];
      if (row === 2 && col === C_INI) return [{ row: 1, col: C_INI }];
      if (row === 1 && col === C_FIM) return [{ row: 0, col: C_FIM }, { row: 2, col: C_FIM }]; // Ramo J1
      if (row === 0 && col === C_INI) return [{ row: 1, col: C_INI }];

      // Percurso J2 (Simétrico)
      if (row === 0 && col === C_FIM) return [{ row: 1, col: C_FIM }];
      if (row === 1 && col === C_INI) return [{ row: 2, col: C_INI }];
      if (row === 2 && col === C_FIM) return [{ row: 3, col: C_FIM }, { row: 1, col: C_FIM }]; // Ramo J2
      if (row === 3 && col === C_INI) return [{ row: 2, col: C_INI }];
      
      return [];
    }

    // DFS “puro” a contar passos exatos
    function dfs(pos, stepsLeft, leftInitial, enteredLast) {
      if (stepsLeft === 0) {
        const occ = cell(pos.row, pos.col);
        if (!occ || occ.player !== player) results.add(key(pos));
        return;
      }

      const options = stepFrom(pos);
      for (const nxt of options) {
        // (1) Não regressa à fila inicial depois de sair
        const isEnteringInitialRow = (pos.row !== initialRow && nxt.row === initialRow);
        if (leftInitial && isEnteringInitialRow) {
          continue;
        }
        // (2) Só entra na última fila se a fila inicial estiver vazia
        if (nxt.row === lastRow && hasOwnOnInitialRow(player)) continue;

        // (3) "só pode ENTRAR uma única vez"
        const justEnteringLast = (nxt.row === lastRow && pos.row !== lastRow);
        
        if (enteredLast && justEnteringLast) {
            continue;
        }

        const nextEnteredLast = enteredLast || justEnteringLast;
        
        dfs(nxt, stepsLeft - 1, leftInitial, nextEnteredLast);
      }
    }

    const alreadyLeftInitial = (piece.hasMoved);
    
    // O 'enteredLast' inicial é o estado guardado na PEÇA
    dfs(start, moves, alreadyLeftInitial, piece.hasReachedEnd);

    // Converte para array de coordenadas
    return Array.from(results).map(k => {
      const [r, c] = k.split(',').map(Number);
      return { row: r, col: c };
    });
  }

  function movePieceTo(piece, targetRow, targetCol) {
    const from = { row: piece.row, col: piece.col };
    const to = { row: targetRow, col: targetCol };
    const targets = getValidMovesFrom(piece, dice || 0);
    if (!targets.some(p => p.row === to.row && p.col === to.col)) {
      throw new Error('Jogada inválida para esta peça e valor do dado.');
    }

    const occupant = cell(to.row, to.col);
    let captured = null;
    if (occupant && occupant.player !== piece.player) {
      // remove peça capturada
      const arr = pieces[occupant.player];
      const idx = arr.indexOf(occupant);
      if (idx >= 0) arr.splice(idx, 1);
      captured = occupant;
    }

    // move
    setCell(from.row, from.col, null);
    setCell(to.row, to.col, piece);
    
    piece.hasMoved = true;

    // Entrou na última fila? SÓ atualiza se for a primeira vez
    const lastRow = lastRowOf(piece.player);
    if (to.row === lastRow) {
      piece.hasReachedEnd = true;
    }

    // fim da jogada
    const extraTurn = [1, 4, 6].includes(dice);
    dice = null;
    return { captured, extraTurn };
  }

  // API pública do motor
  return {
    // NOVO: Permite ao motor online injetar estado
    overrideState(newBoard, newPieces, newPlayer, newDice) {
      board = newBoard;
      pieces = newPieces;
      currentPlayer = newPlayer;
      dice = newDice;
      selected = null;
    },

    // leitura
    getColumns: () => columns,
    getBoard:   () => board,
    getPieces:  () => pieces,
    getPieceCounts() {
      return {
        player1: pieces[1].length,
        player2: pieces[2].length
      };
    },
    getCurrentPlayer: () => currentPlayer,
    getDice: () => dice,

    // dado
    canRoll: () => dice == null,
    rollDice,

    // seleção/movimento
    getSelectableCells() {
      const res = [];
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < columns; c++) {
          const p = cell(r, c);
          if (p && p.player === currentPlayer){
           res.push(p); // Retorna o objeto peça completo
          }
        }
      }
      return res;
    },
    getValidMoves(r, c) {
      if (dice == null) return [];
      const p = cell(r, c);
      if (!p || p.player !== currentPlayer) return [];
      selected = p;
      return getValidMovesFrom(p, dice);
    },
    moveSelectedTo(r, c) {
      if (!selected) throw new Error('Nenhuma peça selecionada.');
      const piece = selected;
      selected = null;
      const { captured, extraTurn } = movePieceTo(piece, r, c);

      if (!extraTurn) currentPlayer = (currentPlayer === 1 ? 2 : 1);

      return { captured, extraTurn };
    },
    
    getHypotheticalMoves(r, c, hypotheticalDice, asPlayer) {
      if (hypotheticalDice == null || hypotheticalDice < 1 || !asPlayer) {
        return [];
      }
      
      const realPiece = cell(r, c); 

      if (realPiece && realPiece.player === asPlayer) {
        return getValidMovesFrom(realPiece, hypotheticalDice);
      }

      const hasReachedEnd = (r === lastRowOf(asPlayer));
      const dummyPiece = {
        player: asPlayer,
        hasMoved: true, 
        hasReachedEnd: hasReachedEnd,
        row: r,
        col: c
      };
      
      return getValidMovesFrom(dummyPiece, hypotheticalDice);
    },

    hasPiecesOnInitialRow(player) {
      return hasOwnOnInitialRow(player);
    },

    passTurn() {
      if (dice == null) throw new Error('Tem de lançar o dado antes de passar.');
      const any = this.getSelectableCells().some(({ row, col }) => this.getValidMoves(row, col).length > 0);
      if (any) throw new Error('Ainda há jogadas possíveis.');
      
      const extraTurn = [1, 4, 6].includes(dice); 
      
      selected = null;
      dice = null;

      if (!extraTurn) {
        currentPlayer = (currentPlayer === 1 ? 2 : 1);
      }
    },
    giveUp() {
      // O jogador que clica em "desistir" é sempre o Humano (Jogador 1).
      // Portanto, o vencedor é sempre o Jogador 2 (IA).
      return { winner: 2 };
    },
    checkWinner() {
      if (pieces[1].length === 0) return 2; // azul vence
      if (pieces[2].length === 0) return 1; // vermelho vence
      return null;
    },

    canPass() {
      if (dice == null) return false;
      return !this.getSelectableCells().some(({ row, col }) => this.getValidMoves(row, col).length > 0);
    }
  };
}