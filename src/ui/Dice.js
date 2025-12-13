import { playSound } from '../core/audio.js'; 
import { state } from '../core/state.js';

export function Dice(onRoll){
  const wrap = document.createElement('div');
  wrap.className = 'dice';

  const sticks = document.createElement('div');
  sticks.className = 'dice-sticks';
  const arr = [];
  for (let i=0;i<4;i++){
    const s = document.createElement('div');
    s.className = 'stick';
    s.innerHTML = `<div class="stick-face light"></div><div class="stick-face dark"></div>`;
    sticks.appendChild(s); arr.push(s);
  }

  const read = document.createElement('div');
  read.className = 'dice-readout';
  read.innerHTML = `<div id="dice-value"></div><div id="dice-name"></div>`;

  const btn = document.createElement('button');
  btn.className = 'btn btn-primary';
  btn.textContent = 'Lançar Dado';

  //  GLOW DOURADO quando disponível
  btn.classList.add('dice-ready');

  btn.onclick = async () => {
    // Se já estiver desativado pela GameView, não faz nada
    if (btn.classList.contains('is-disabled')) return; 
    
    playSound('flip'); //TOCA O SOM AQUI

    // Remove glow
    btn.classList.remove('dice-ready');
    
    // Desativa-se temporariamente durante a animação
    btn.classList.add('is-disabled'); 
    btn.style.opacity = '0.6';

    // Se as animações estiverem LIGADAS, faz o "shuffle"
    if (state.config.animations !== false) {
      arr.forEach(s => s.classList.add('shuffling'));
      await new Promise(r=>setTimeout(r,800));
      arr.forEach(s => s.classList.remove('shuffling'));
    }

    const value = await onRoll?.();
    
    // No modo online, onRoll retorna null (aguarda SSE)
    if (value !== null && value !== undefined) {
      setDiceVisual(value);
      
      // Se as animações estiverem LIGADAS, faz o "bounce" e as "partículas"
      if (state.config.animations !== false) {
        // BOUNCE
        sticks.classList.add('dice-bounce');
        setTimeout(() => sticks.classList.remove('dice-bounce'), 600);
        
        // PARTÍCULAS 
        if (value === 6 || value === 4 || value === 1) {
          createGoldenParticles(wrap);
        }
      }
    }
    // Se value é null (online), o botão permanece desabilitado até SSE chegar
  };

  function setDiceVisual(val){
    const lightFaces = (val===6?0:val);
    arr.forEach((s,idx)=>{
      const light = idx < lightFaces;
      s.style.transform = `rotateY(${light?0:180}deg)`;
    });
    read.querySelector('#dice-value').textContent = `Valor: ${val ?? '-'}`;
    read.querySelector('#dice-name').textContent = nameMap[val] ?? '';
  }

  function createGoldenParticles(container) {
    createGoldenParticlesExported(container);
  }

  wrap.append(sticks, btn, read);
  return wrap;
}

export function setDiceValue(diceEl, val){
  // compat: tenta atualizar readout se existir
  const read = diceEl?.querySelector?.('.dice-readout');
  if (read){
    const v = read.querySelector('#dice-value');
    const n = read.querySelector('#dice-name');
    
    // Se val é null, não atualiza o visual dos sticks (aguarda SSE)
    if (val !== null && val !== undefined) {
      const light = (val === 6 ? 0 : val);
      diceEl.querySelectorAll('.stick').forEach((s,idx)=>{
        s.style.transform = `rotateY(${idx<light?0:180}deg)`;
      });
    }
    
    if (v) v.textContent = `Valor: ${val ?? '-'}`;
    if (n) n.textContent = nameMap[val] ?? '';
  }
}

const nameMap = { 6:'Sitteh', 1:'Tâb', 2:'Itneyn', 3:'Teláteh', 4:"Arba'ah" };

export function createGoldenParticlesExported(container) {
  const rect = container.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  
  for (let i = 0; i < 16; i++) {
    const particle = document.createElement('div');
    particle.className = 'golden-particle';
    particle.style.left = centerX + 'px';
    particle.style.top = centerY + 'px';
    
    const angle = (i / 16) * Math.PI * 2;
    const distance = 80 + Math.random() * 40;
    const endX = Math.cos(angle) * distance;
    const endY = Math.sin(angle) * distance;
    
    particle.style.setProperty('--end-x', endX + 'px');
    particle.style.setProperty('--end-y', endY + 'px');
    particle.style.animationDelay = (i * 20) + 'ms';
    
    document.body.appendChild(particle);
    setTimeout(() => particle.remove(), 1000);
  }
}
