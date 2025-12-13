/**
 * Debounce: Atrasa execução de função até que param de chamar
 * Útil para resize, scroll, input events
 * @param {Function} func - Função a executar
 * @param {number} wait - Tempo de espera em ms
 * @returns {Function} Função debounced
 */
export function debounce(func, wait = 200) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle: Limita execução de função a uma vez por intervalo
 * Útil para scroll, mousemove events
 * @param {Function} func - Função a executar
 * @param {number} limit - Tempo mínimo entre execuções em ms
 * @returns {Function} Função throttled
 */
export function throttle(func, limit = 100) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * RequestAnimationFrame wrapper para animações otimizadas
 * @param {Function} callback - Função a executar no próximo frame
 * @returns {number} ID do request
 */
export function nextFrame(callback) {
  return requestAnimationFrame(callback);
}

/**
 * Aguarda múltiplos frames antes de executar
 * @param {Function} callback - Função a executar
 * @param {number} frames - Número de frames a aguardar
 */
export function waitFrames(callback, frames = 1) {
  if (frames <= 0) {
    callback();
    return;
  }
  requestAnimationFrame(() => waitFrames(callback, frames - 1));
}
