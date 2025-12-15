// Regras completas do Tâb 

export function createTabEngine(opts = {}) {
  const columns = clampOdd(opts.columns ?? 9, 7, 15);

  //Estado 
  let board = Array.from({ length: 4 }, (_, r) =>
    Array.from({ length: columns }, (_, c) => null)
  );

  let pieces = { 1: [], 2: [] }; 

  // coloca peças
  for (let c = 0; c < columns; c++) {
    const pBlue = { player: 2, hasMoved: false, hasReachedEnd: false, row: 0, col: c };
    const pRed  = { player: 1, hasMoved: false, hasReachedEnd: false, row: 3, col: c };
    board[0][c] = pBlue; pieces[2].push(pBlue);
    board[3][c] = pRed;  pieces[1].push(pRed);
  }

  let currentPlayer = 1; // vermelho começa
  let dice = null;
  let selected = null; // Guarda a peça selecionada

  //Helpers
  function clampOdd(n, min, max) {
    const nn = Math.max(min, Math.min(max, n | 0));
    return nn % 2 === 0 ? nn + 1 : nn;
  }
  
  const dirForRow = (row) => ((row === 1 || row === 3) ? +1 : -1); 
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

  function hasOwnOnInitialRow(player) {
    const r0 = initialRowOf(player);
    return pieces[player].some(p => p.row === r0);
  }

  //Dado de paus 
  function rollDice() {
    // Probabilidades aproximadas do jogo real
    const r = Math.random();
    let val = (r < 0.0625) ? 6 : (r < 0.3125) ? 1 : (r < 0.6875) ? 2 : (r < 0.9375) ? 3 : 4;

    // O servidor retorna o valor e a flag 'keepPlaying' informa o cliente que pode rolar de novo.
    dice = val;
    return dice;
  }

  // Movimentação
  function getValidMovesFrom(piece, moves) {
    if (!moves || moves <= 0) return [];
    const player = piece.player;
    const start = { row: piece.row, col: piece.col };
    const initialRow = initialRowOf(player);
    const lastRow = lastRowOf(player);

    // Regra: Para sair da linha inicial, é preciso tirar um Tâb 
    if (!piece.hasMoved && moves !== 1) {
        return [];
    }

    // Regra: Peça NA última linha só se move se não houver peças na inicial
    if (start.row === lastRow && hasOwnOnInitialRow(player)) {
      return [];
    }

    const results = new Set();
    const key = (p) => `${p.row},${p.col}`;

    function stepFrom(pos) {
      const { row, col } = pos;
      const dir = dirForRow(row); 
      const nextCol = col + dir;

      // 1. Movimento dentro da linha
      if (nextCol >= 0 && nextCol < columns) {
        return [{ row, col: nextCol }];
      }

      // 2. Transições de extremidade
      const C_FIM = columns - 1;
      const C_INI = 0;

      // Percurso J1
      if (row === 3 && col === C_FIM) return [{ row: 2, col: C_FIM }];
      if (row === 2 && col === C_INI) return [{ row: 1, col: C_INI }];
      if (row === 1 && col === C_FIM) return [{ row: 0, col: C_FIM }, { row: 2, col: C_FIM }]; 
      if (row === 0 && col === C_INI) return [{ row: 1, col: C_INI }];

      // Percurso J2
      if (row === 0 && col === C_FIM) return [{ row: 1, col: C_FIM }];
      if (row === 1 && col === C_INI) return [{ row: 2, col: C_INI }];
      if (row === 2 && col === C_FIM) return [{ row: 3, col: C_FIM }, { row: 1, col: C_FIM }]; 
      if (row === 3 && col === C_INI) return [{ row: 2, col: C_INI }];
      
      return [];
    }

    function dfs(pos, stepsLeft, leftInitial, enteredLast) {
      if (stepsLeft === 0) {
        const occ = cell(pos.row, pos.col);
        // Só pode parar se estiver vazio ou com peça inimiga
        if (!occ || occ.player !== player) results.add(key(pos));
        return;
      }

      const options = stepFrom(pos);
      for (const nxt of options) {
        const isEnteringInitialRow = (pos.row !== initialRow && nxt.row === initialRow);
        if (leftInitial && isEnteringInitialRow) continue;
        
        if (nxt.row === lastRow && hasOwnOnInitialRow(player)) continue;

        const justEnteringLast = (nxt.row === lastRow && pos.row !== lastRow);
        if (enteredLast && justEnteringLast) continue;

        const nextEnteredLast = enteredLast || justEnteringLast;
        dfs(nxt, stepsLeft - 1, leftInitial, nextEnteredLast);
      }
    }

    const alreadyLeftInitial = (piece.hasMoved);
    dfs(start, moves, alreadyLeftInitial, piece.hasReachedEnd);

    return Array.from(results).map(k => {
      const [r, c] = k.split(',').map(Number);
      return { row: r, col: c };
    });
  }

  function movePieceTo(piece, targetRow, targetCol) {
    const from = { row: piece.row, col: piece.col };
    const to = { row: targetRow, col: targetCol };
    const targets = getValidMovesFrom(piece, dice || 0);
    
    // Validação extra de segurança
    if (!targets.some(p => p.row === to.row && p.col === to.col)) {
      throw new Error('Jogada inválida para esta peça.');
    }

    const occupant = cell(to.row, to.col);
    let captured = null;
    if (occupant && occupant.player !== piece.player) {
      const arr = pieces[occupant.player];
      const idx = arr.indexOf(occupant);
      if (idx >= 0) arr.splice(idx, 1);
      captured = occupant;
    }

    setCell(from.row, from.col, null);
    setCell(to.row, to.col, piece);
    
    piece.hasMoved = true;

    const lastRow = lastRowOf(piece.player);
    if (to.row === lastRow) {
      piece.hasReachedEnd = true;
    }

    const extraTurn = [1, 4, 6].includes(dice);
    dice = null;
    return { captured, extraTurn };
  }

  // API pública
  return {
    overrideState(newBoard, newPieces, newPlayer, newDice) {
      board = newBoard;
      pieces = newPieces;
      currentPlayer = newPlayer;
      dice = newDice;
      selected = null;
    },

    getColumns: () => columns,
    getBoard:   () => board,
    getCurrentPlayer: () => currentPlayer,
    getDice: () => dice,
    
    // Verifica se pode lançar dado
    canRoll: () => dice == null,
    rollDice,

    getSelectableCells() {
      const res = [];
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < columns; c++) {
          const p = cell(r, c);
          if (p && p.player === currentPlayer) res.push(p);
        }
      }
      return res;
    },

    getValidMoves(r, c) {
      if (dice == null) return [];
      const p = cell(r, c);
      if (!p || p.player !== currentPlayer) return [];
      
      return getValidMovesFrom(p, dice);
    },

    // Métodos de gestão de Seleção
    selectPiece(r, c) {
      const p = cell(r, c);
      if (!p || p.player !== currentPlayer) throw new Error("Peça inválida");
      selected = p;
      return getValidMovesFrom(p, dice);
    },

    deselect() {
      selected = null;
    },
    
    getSelected: () => selected,

    moveSelectedTo(r, c) {
      if (!selected) throw new Error('Nenhuma peça selecionada.');
      const piece = selected;
      
      // Limpa seleção ANTES de mover para evitar estados inconsistentes se falhar
      selected = null; 
      
      const { captured, extraTurn } = movePieceTo(piece, r, c);

      // Se não for turno extra, passa a vez
      if (!extraTurn) currentPlayer = (currentPlayer === 1 ? 2 : 1);

      return { captured, extraTurn };
    },
    
    checkWinner() {
      if (pieces[1].length === 0) return 2; 
      if (pieces[2].length === 0) return 1; 
      return null;
    },

    // Passar a vez (se bloqueado)
    passTurn() {
      if (dice == null) throw new Error('Tem de lançar o dado antes de passar.');
      
      // Validação: Só pode passar se NÃO houver movimentos válidos
      const any = this.getSelectableCells().some(p => getValidMovesFrom(p, dice).length > 0);
      if (any) throw new Error('Ainda há jogadas possíveis.');
      
      const extraTurn = [1, 4, 6].includes(dice); 
      selected = null;
      dice = null;

      //Se tirou 1, 4 ou 6, mantém a vez mesmo sem movimentos (jogada extra)
      if (!extraTurn) {
        currentPlayer = (currentPlayer === 1 ? 2 : 1);
      }
    },
    
    canPass() {
      if (dice == null) return false;
      return !this.getSelectableCells().some(p => getValidMovesFrom(p, dice).length > 0);
    }
  };
}