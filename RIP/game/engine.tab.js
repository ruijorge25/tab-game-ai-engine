// Regras completas do Tâb — engine “puro” (sem UI)

export function createTabEngine(opts = {}) {
  // Garante que é ímpar entre 7 e 15
  const columns = Math.max(7, Math.min(15, (opts.columns % 2 === 0 ? opts.columns + 1 : opts.columns) || 9));

  // ------- Estado -------
  let board = Array.from({ length: 4 }, (_, r) =>
    Array.from({ length: columns }, (_, c) => null)
  );

  let pieces = { 1: [], 2: [] }; // 1 = vermelho, 2 = azul

  // Coloca peças iniciais
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

  function allPiecesUnmoved(player) {
    return pieces[player].every(p => !p.hasMoved);
  }

  // -------- Dado de paus --------
  function rollDice() {
    const r = Math.random();
    let val = (r < 0.0625) ? 6 : (r < 0.3125) ? 1 : (r < 0.6875) ? 2 : (r < 0.9375) ? 3 : 4;

    if (allPiecesUnmoved(currentPlayer) && (val === 4 || val === 6)) {
      return rollDice(); // Recursão se não puder sair
    }

    dice = val;
    return dice;
  }

  // Movimentação (Lógica de DFS para calcular destinos)
  function getValidMovesFrom(piece, moves) {
    if (!moves || moves <= 0) return [];
    const player = piece.player;
    const start = { row: piece.row, col: piece.col };
    const initialRow = initialRowOf(player);
    const lastRow = lastRowOf(player);

    if (!piece.hasMoved && moves !== 1) return [];
    if (start.row === lastRow && hasOwnOnInitialRow(player)) return [];

    const results = new Set();
    const key = (p) => `${p.row},${p.col}`;

    function stepFrom(pos) {
      const { row, col } = pos;
      const dir = dirForRow(row);
      const nextCol = col + dir;
      if (nextCol >= 0 && nextCol < columns) return [{ row, col: nextCol }];
      
      const C_FIM = columns - 1, C_INI = 0;
      if (row === 3 && col === C_FIM) return [{ row: 2, col: C_FIM }];
      if (row === 2 && col === C_INI) return [{ row: 1, col: C_INI }];
      if (row === 1 && col === C_FIM) return [{ row: 0, col: C_FIM }, { row: 2, col: C_FIM }];
      if (row === 0 && col === C_INI) return [{ row: 1, col: C_INI }];
      
      // Player 2
      if (row === 0 && col === C_FIM) return [{ row: 1, col: C_FIM }];
      if (row === 1 && col === C_INI) return [{ row: 2, col: C_INI }];
      if (row === 2 && col === C_FIM) return [{ row: 3, col: C_FIM }, { row: 1, col: C_FIM }];
      if (row === 3 && col === C_INI) return [{ row: 2, col: C_INI }];
      return [];
    }

    function dfs(pos, stepsLeft, leftInitial, enteredLast) {
      if (stepsLeft === 0) {
        const occ = cell(pos.row, pos.col);
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
        dfs(nxt, stepsLeft - 1, leftInitial, enteredLast || justEnteringLast);
      }
    }
    dfs(start, moves, piece.hasMoved, piece.hasReachedEnd);
    return Array.from(results).map(k => {
      const [r, c] = k.split(',').map(Number);
      return { row: r, col: c };
    });
  }

  function movePieceTo(piece, targetRow, targetCol) {
    const targets = getValidMovesFrom(piece, dice || 0);
    if (!targets.some(p => p.row === targetRow && p.col === targetCol)) {
      throw new Error('Jogada inválida.');
    }

    const occupant = cell(targetRow, targetCol);
    let captured = null;
    if (occupant && occupant.player !== piece.player) {
      const arr = pieces[occupant.player];
      arr.splice(arr.indexOf(occupant), 1);
      captured = occupant;
    }

    setCell(piece.row, piece.col, null);
    setCell(targetRow, targetCol, piece);
    piece.hasMoved = true;
    if (targetRow === lastRowOf(piece.player)) piece.hasReachedEnd = true;

    const extraTurn = [1, 4, 6].includes(dice);
    dice = null;
    return { captured, extraTurn };
  }

  return {
    getColumns: () => columns,
    getBoard: () => board,
    getDice: () => dice,
    getCurrentPlayer: () => currentPlayer,
    getSelected: () => selected,
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
    checkWinner() {
        if (pieces[1].length === 0) return 2;
        if (pieces[2].length === 0) return 1;
        return null;
    }
  };
}