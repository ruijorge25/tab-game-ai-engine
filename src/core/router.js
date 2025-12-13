import { renderMenuView }   from '../views/MenuView.js';
import { renderConfigView } from '../views/ConfigView.js';
import { renderGameView }   from '../views/GameView.js';
import { renderResultView } from '../views/ResultView.js';
import { state } from './state.js';

const routes = {
  menu:   renderMenuView,
  config: renderConfigView,
  game:   renderGameView,
  result: renderResultView
};

export function initRouter() {
  console.log('Router pronto');
}

export function navigateTo(view) {
  const render = routes[view];
  if (!render) {
    console.error(`Rota desconhecida: ${view}`);
    return;
  }
  
  // Limpar event listeners da view anterior
  if (window.cleanupMenuView) {
    window.cleanupMenuView();
    window.cleanupMenuView = null;
  }
  if (window.cleanupGameView) {
    window.cleanupGameView();
    window.cleanupGameView = null;
  }
  if (window.cleanupConfigView) {
    window.cleanupConfigView();
    window.cleanupConfigView = null;
  }
  if (window.cleanupResultView) {
    window.cleanupResultView();
    window.cleanupResultView = null;
  }
  
  state.currentView = view;
  const app = document.getElementById('app');
  app.innerHTML = '';
  render(app);
}
