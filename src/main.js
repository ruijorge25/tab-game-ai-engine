import { initRouter, navigateTo } from './core/router.js';
import { initState, state } from './core/state.js';
import { initAnimationCanvas, startThemeAnimation } from './core/animations.js';
import { setThemeMusic } from './core/audio.js';

window.addEventListener('DOMContentLoaded', () => {
  initState();
  
  // Inicializa canvas de animações
  initAnimationCanvas();
  
  // Aplica o tema e estilo de peças salvos
  const currentTheme = state.config.theme || 'desert';
  document.body.dataset.theme = currentTheme;
  document.body.dataset.pieceStyle = state.config.pieceStyle || 'modern';
  document.body.dataset.animSpeed = state.config.animSpeed || 'normal';
  
  if (state.config.animations === false) {
    document.body.classList.add('no-animations');
  }
  
  // Inicia animações E MÚSICA do tema
  setThemeMusic(currentTheme); 
  startThemeAnimation(currentTheme);
  
  // Observa mudanças no tema para aplicar efeitos
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
        const newTheme = document.body.dataset.theme;
        setThemeMusic(newTheme);
        startThemeAnimation(newTheme);
      }
    });
  });
  
  observer.observe(document.body, { attributes: true });
  
  initRouter();
  navigateTo('menu');
});

