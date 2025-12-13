// Componente do Tabuleiro: 4 linhas x N colunas, casas brancas e peças coloridas

export function Board({ engine, onSelect, onMove }) {
  const el = document.createElement('div');
  el.className = 'board-wrap';

  // grid
  const grid = document.createElement('div');
  grid.className = 'board-grid';
  el.appendChild(grid);

  function render() {
    const cols = engine.getColumns();
    const board = engine.getBoard();

    // Define o grid: 4 linhas fixas x N colunas
    grid.style.gridTemplateColumns = `repeat(${cols}, 72px)`;
    grid.style.gridTemplateRows = 'repeat(4, 72px)';
    grid.innerHTML = '';

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'board-cell';
        cell.dataset.r = r;
        cell.dataset.c = c;

        const data = board[r][c];

        if (data) {
          const piece = document.createElement('div');
          piece.className = `piece ${data.player === 1 ? 'piece-yellow' : 'piece-blue'}`;
          if (!data.hasMoved) piece.classList.add('piece-unmoved');
          if (data.hasReachedEnd) piece.classList.add('piece-visited-last');
          cell.appendChild(piece);
        }

        cell.addEventListener('click', () => {
          const sel = cell.classList.contains('is-target');
          if (sel) {
            onMove?.(r, c);
          } else {
            onSelect?.(r, c);
          }
        });

        grid.appendChild(cell);
      }
    }
  }

  function highlightSelection(r, c, moves) {
    clearHighlights();

    const cols = engine.getColumns();
    const idx = (rr, cc) => (rr * cols + cc);
    const cells = [...grid.children];

    // selecionada
    const sc = cells[idx(r, c)];
    if (sc) sc.classList.add('is-selected');

    // destinos
    for (const m of moves) {
      const t = cells[idx(m.row, m.col)];
      if (t) t.classList.add('is-target');
    }
  }

  function clearHighlights() {
    grid.querySelectorAll('.is-selected, .is-target').forEach(n => n.classList.remove('is-selected', 'is-target'));
  }

  render();

  return { el, render, highlightSelection, clearHighlights };
}
