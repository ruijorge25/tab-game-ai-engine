import { navigateTo } from '../core/router.js';

export function renderResultView(container) {
  const root = document.createElement('div');
  root.className = 'view result-view';
  root.innerHTML = `
    <section class="panel">
      <h1>Resultado</h1>
      <p>Placeholder do ecrã de resultados.</p>
      <div style="margin-top:16px; display:flex; gap:8px;">
        <button class="btn-primary" id="new-game">Novo Jogo</button>
        <button class="btn-secondary" id="to-menu">Menu</button>
      </div>
    </section>
  `;

  root.querySelector('#new-game').onclick = () => navigateTo('game');
  root.querySelector('#to-menu').onclick = () => navigateTo('menu');

  container.appendChild(root);
}
