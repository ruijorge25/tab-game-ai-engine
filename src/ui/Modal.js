import { state } from '../core/state.js';
import { network } from '../core/network.js';

let activeModal = null;
let activeEscHandler = null;

/**
 * Cria e exibe um modal genérico
 */
export function showModal({ title, content, buttons = [], onClose, className = '' }) {
  if (activeModal) closeModal();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  
  const modal = document.createElement('div');
  modal.className = `modal ${className}`;
  
  const header = document.createElement('div');
  header.className = 'modal-header';
  header.innerHTML = `
    <h2 class="modal-title">${title}</h2>
    <button class="modal-close" aria-label="Fechar">&times;</button>
  `;
  
  const body = document.createElement('div');
  body.className = 'modal-body';
  body.innerHTML = content;
  
  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  
  buttons.forEach(btn => {
    const button = document.createElement('button');
    button.className = btn.className || 'btn btn-secondary';
    button.textContent = btn.text;
    button.onclick = () => {
      if (btn.onClick) btn.onClick();
      // Nota: alguns botões podem não querer fechar logo (ex: tabs)
      if (!btn.preventClose) closeModal();
    };
    footer.appendChild(button);
  });
  
  modal.appendChild(header);
  modal.appendChild(body);
  if (buttons.length > 0) modal.appendChild(footer);
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  activeModal = { overlay, onClose };
  
  requestAnimationFrame(() => overlay.classList.add('show'));
  
  const closeBtn = header.querySelector('.modal-close');
  closeBtn.onclick = closeModal;
  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
  
  if (activeEscHandler) document.removeEventListener('keydown', activeEscHandler);
  activeEscHandler = (e) => { if (e.key === 'Escape') closeModal(); };
  document.addEventListener('keydown', activeEscHandler);
}

export function closeModal() {
  if (!activeModal) return;
  if (activeEscHandler) {
    document.removeEventListener('keydown', activeEscHandler);
    activeEscHandler = null;
  }
  const { overlay, onClose } = activeModal;
  overlay.classList.remove('show');
  setTimeout(() => {
    overlay.remove();
    if (onClose) onClose();
  }, 300);
  activeModal = null;
}

/* Modal de Regras */
export function showRulesModal() {
  showModal({
    title: 'Regras do Tâb',
    className: 'modal-rules',
    content: `
      <div class="rules-content">
        <section class="rule-section">
          <h3>Objetivo</h3>
          <p>Capture todas as peças do adversário para vencer!</p>
        </section>
        <section class="rule-section">
          <h3>O Dado de Paus</h3>
          <p>Usa-se 4 paus com duas faces (clara e escura). O resultado define quantas casas a peça avança:</p>
          <ul>
            <li><strong>0 claros → 6</strong> (Sitteh) - Joga novamente</li>
            <li><strong>1 claro → 1</strong> (Tâb) - Joga novamente</li>
            <li><strong>2 claros → 2</strong> (Itneyn)</li>
            <li><strong>3 claros → 3</strong> (Telâteh)</li>
            <li><strong>4 claros → 4</strong> (Arba'ah) - Joga novamente</li>
          </ul>
        </section>
        <section class="rule-section">
          <h3>Primeira Jogada</h3>
          <p>Para mover uma peça pela primeira vez, <strong>deve obter 1</strong> (Tâb) no dado.</p>
          <p>Se sair 4 ou 6, repete o lançamento.</p>
        </section>
        <section class="rule-section">
          <h3>Capturas</h3>
          <p>Se a casa de destino tiver uma peça adversária, essa peça é <strong>capturada e removida</strong>.</p>
        </section>
      </div>
    `,
    buttons: [{ text: 'Entendi', className: 'btn btn-primary' }]
  });
}

/* Modal de Vitória (Híbrido: Suporta Online e Local) */
export function showVictoryModal({ winner, stats = {}, onPlayAgain, onGoToMenu }) {
  // Ajuste: winner pode ser ID (1) ou Nick (string)
  let isPlayerWin = false;
  let winnerName = 'IA';

  if (typeof winner === 'number') {
    isPlayerWin = (winner === 1); // 1 = Local Player
  } else {
    // Online: Compara nick
    const myNick = state.session?.nick;
    isPlayerWin = (winner === myNick);
    winnerName = winner;
  }
  
  if (isPlayerWin && state.config.animations !== false) {
    createConfetti(150);
  }
  
  showModal({
    title: isPlayerWin ? 'Vitória!' : 'Derrota',
    className: `modal-result ${isPlayerWin ? 'modal-victory' : 'modal-defeat'}`,
    content: `
      <div class="result-content">
        ${isPlayerWin ? '<div class="trophy-3d"></div>' : '<div class="result-icon"></div>'}
        <h3 class="result-message">${isPlayerWin ? 'Parabéns! Você venceu!' : `O vencedor foi ${winnerName}!`}</h3>
        
        ${stats.captures !== undefined ? `
          <div class="result-stats">
            <div class="stat-item">
              <span class="stat-label">Capturas</span>
              <span class="stat-value animated-stat" data-value="${stats.captures || 0}">0</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Jogadas</span>
              <span class="stat-value animated-stat" data-value="${stats.moves || 0}">0</span>
            </div>
          </div>
        ` : ''}
        
        ${!isPlayerWin ? '<p class="result-tip">Dica: Proteja suas peças e planeje capturas!</p>' : ''}
      </div>
    `,
    buttons: [
      { text: 'Jogar Novamente', className: 'btn btn-primary', onClick: () => { if (onPlayAgain) onPlayAgain(); }},
      { text: 'Menu', className: 'btn btn-secondary', onClick: () => { if (onGoToMenu) onGoToMenu(); }}
    ],
    onClose: () => {
      document.querySelectorAll('.confetti-piece').forEach(el => el.remove());
      if (onGoToMenu) onGoToMenu();
    }
  });
  
  setTimeout(() => animateStats(), 300);
}

/* Helpers Visuais */
function animateStats() {
  const statElements = document.querySelectorAll('.animated-stat');
  statElements.forEach((el, index) => {
    const targetValue = parseInt(el.dataset.value);
    let currentValue = 0;
    const stepTime = 30;
    const steps = 1000 / stepTime;
    const increment = targetValue / steps;
    
    if (targetValue > 0) {
      setTimeout(() => {
        const interval = setInterval(() => {
          currentValue += increment;
          if (currentValue >= targetValue) { currentValue = targetValue; clearInterval(interval); }
          el.textContent = Math.floor(currentValue);
        }, stepTime);
      }, index * 200);
    }
  });
}

function createConfetti(count = 150) {
  const colors = ['#CBB279', '#C17F59', '#D4AF37', '#F8F5E1', '#A35F3B'];
  for (let i = 0; i < count; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti-piece';
    confetti.style.left = Math.random() * 100 + '%';
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDelay = Math.random() * 3 + 's';
    confetti.style.animationDuration = Math.random() * 3 + 2 + 's';
    document.body.appendChild(confetti);
    setTimeout(() => confetti.remove(), 5000);
  }
}

/* =================================================================
   FUNCIONALIDADES RESTAURADAS: LEADERBOARD LOCAL + ONLINE
   ================================================================= */

/* Modal Inteligente: Mostra Local por defeito, com opção para Online */
export function showLeaderboardModal() {
  // 1. Gera o HTML Local (Código Original Restaurado)
  const stats = getPlayerStats();
  const localHTML = `
    <div id="tab-local" class="leaderboard-tab-content">
      ${stats.username ? `<div class="current-player"><h3>${stats.username} (Local)</h3></div>` : ''}
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-number">${stats.gamesPlayed || 0}</div>
          <div class="stat-label">Jogos</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${stats.wins || 0}</div>
          <div class="stat-label">Vitórias</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${stats.losses || 0}</div>
          <div class="stat-label">Derrotas</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${stats.winRate || 0}%</div>
          <div class="stat-label">Taxa de Vitória</div>
        </div>
      </div>
      ${stats.topGames && stats.topGames.length > 0 ? `
        <div class="top-games">
          <h4>Melhores Partidas (Local)</h4>
          <table class="games-table">
            <thead><tr><th>Resultado</th><th>Capturas</th><th>Jogadas</th></tr></thead>
            <tbody>
              ${stats.topGames.slice(0, 5).map(game => `
                <tr>
                  <td>${game.won ? 'Vitória' : 'Derrota'}</td>
                  <td>${game.captures}</td>
                  <td>${game.moves}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<p class="no-games">Nenhuma partida local registada.</p>'}
    </div>
  `;

  // 2. Prepara container para Online
  const onlineHTML = `
    <div id="tab-online" class="leaderboard-tab-content" style="display:none;">
       <div id="online-controls" style="display:flex; gap:10px; align-items:center; margin-bottom:12px;">
          <label style="opacity:0.8;">Grupo:
            <input id="online-group" type="number" min="1" max="999" value="${state.session.group || 34}" style="width:70px; margin-left:6px;">
          </label>
          <label style="opacity:0.8;">Colunas:
            <select id="online-size" style="margin-left:6px;">
              ${[7,9,11].map(v => `<option value="${v}" ${((state.config.columns||9)===v)?'selected':''}>${v}</option>`).join('')}
            </select>
          </label>
          <button id="online-refresh" class="btn btn-secondary" style="padding:6px 10px;">Atualizar</button>
       </div>
       <div id="online-meta" style="opacity:0.8;margin-bottom:12px;font-size:0.9rem;display:none;"></div>
       <div class="loader" style="text-align:center; padding:20px;">
         <p>A carregar Ranking do Servidor...</p>
       </div>
    </div>
  `;

  showModal({
    title: 'Estatísticas',
    className: 'modal-leaderboard',
    content: `
      <div class="tabs-header" style="display:flex; gap:10px; margin-bottom:20px; border-bottom:1px solid #444;">
        <button id="btn-tab-local" class="btn-tab active" style="background:none; border:none; color:var(--sand); padding:10px; cursor:pointer; font-weight:bold; border-bottom:2px solid var(--sand);">Local</button>
        <button id="btn-tab-online" class="btn-tab" style="background:none; border:none; color:#666; padding:10px; cursor:pointer;">Online</button>
      </div>
      ${localHTML}
      ${onlineHTML}
    `,
    buttons: [
      { text: 'Fechar', className: 'btn btn-primary' }
    ]
  });

  // 3. Lógica das Abas
  const btnLocal = document.getElementById('btn-tab-local');
  const btnOnline = document.getElementById('btn-tab-online');
  const divLocal = document.getElementById('tab-local');
  const divOnline = document.getElementById('tab-online');

  btnLocal.onclick = () => {
    divLocal.style.display = 'block';
    divOnline.style.display = 'none';
    btnLocal.style.color = 'var(--sand)';
    btnLocal.style.borderBottom = '2px solid var(--sand)';
    btnOnline.style.color = '#666';
    btnOnline.style.borderBottom = 'none';
  };

  btnOnline.onclick = async () => {
    divLocal.style.display = 'none';
    divOnline.style.display = 'block';
    btnOnline.style.color = 'var(--sand)';
    btnOnline.style.borderBottom = '2px solid var(--sand)';
    btnLocal.style.color = '#666';
    btnLocal.style.borderBottom = 'none';
    
    // Fetch Online se ainda não carregou
    if (!divOnline.dataset.loaded) {
       await fetchOnlineRanking(divOnline);
       divOnline.dataset.loaded = "true";
    }
    // Liga controlos para re-fetch
    const groupInput = document.getElementById('online-group');
    const sizeSelect = document.getElementById('online-size');
    const btnRefresh = document.getElementById('online-refresh');
    const requery = async () => {
      // Atualiza estado global para consistência
      const g = parseInt(groupInput.value) || (state.session.group||34);
      const s = parseInt(sizeSelect.value) || (state.config.columns||9);
      state.session.group = g;
      state.config.columns = s;
      // Limpa conteúdo e volta a carregar
      const meta = divOnline.querySelector('#online-meta');
      meta.style.display = 'none';
      divOnline.querySelector('.leaderboard-content')?.remove();
      let loader = divOnline.querySelector('.loader');
      if (!loader) {
        loader = document.createElement('div');
        loader.className = 'loader';
        loader.style.textAlign = 'center';
        loader.style.padding = '20px';
        loader.innerHTML = '<p>A carregar Ranking do Servidor...</p>';
        divOnline.appendChild(loader);
      }
      await fetchOnlineRanking(divOnline);
    };
    if (btnRefresh && !btnRefresh.dataset.bound) {
      btnRefresh.dataset.bound = 'true';
      btnRefresh.onclick = requery;
      groupInput.onchange = requery;
      sizeSelect.onchange = requery;
    }
  };
}

// Helper para buscar ranking online e injetar no HTML
async function fetchOnlineRanking(container) {
  try {
    const group = state.session.group || 34;
    const size = state.config.columns || 9;
    const response = await network.getRanking(group, size);
    const ranking = response.ranking || [];

    const rows = ranking.length > 0 ? ranking.map((r, i) => `
      <tr>
        <td style="text-align:center">#${i+1}</td>
        <td><strong>${r.nick}</strong></td>
        <td style="text-align:center">${r.victories ?? r.wins ?? 0}</td>
        <td style="text-align:center">${r.games ?? (r.wins + (r.losses||0)) ?? 0}</td>
      </tr>
    `).join('') : '<tr><td colspan="4" style="text-align:center; padding:12px;">Sem dados online.</td></tr>';

    // Atualiza meta existente e revela
    const meta = container.querySelector('#online-meta');
    if (meta) {
      meta.textContent = `Grupo: ${group} • Tamanho: ${size} colunas`;
      meta.style.display = 'block';
    }

    // Injeta tabela mantendo container
    container.querySelector('.loader')?.remove();
    const wrap = document.createElement('div');
    wrap.className = 'leaderboard-content';
    wrap.innerHTML = `
        <table class="games-table" style="width:100%">
          <thead><tr><th>Pos</th><th>Nick</th><th>Vit</th><th>Jogos</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
    `;
    container.appendChild(wrap);
  } catch (err) {
    container.innerHTML = `<p class="error" style="text-align:center; color:var(--red);">Erro: ${err.message}</p>`;
  }
}

/* =================================================================
   FUNÇÕES ORIGINAIS RESTAURADAS (LOCAL)
   ================================================================= */

/* Obtém estatísticas do jogador do localStorage */
function getPlayerStats() {
  const username = localStorage.getItem('tab_username') || null;
  const gamesData = JSON.parse(localStorage.getItem('tab_games') || '[]');
  
  // Filtra jogos do usuário atual
  const userGames = username 
    ? gamesData.filter(g => g.username === username)
    : gamesData;
  
  const wins = userGames.filter(g => g.won).length;
  const losses = userGames.filter(g => !g.won).length;
  const gamesPlayed = userGames.length;
  const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
  
  return {
    username,
    gamesPlayed,
    wins,
    losses,
    winRate,
    topGames: userGames.sort((a, b) => b.captures - a.captures)
  };
}

/* Salva resultado de jogo no localStorage */
export function saveGameResult({ won, captures, moves }) {
  const username = localStorage.getItem('tab_username') || 'Anônimo';
  const gamesData = JSON.parse(localStorage.getItem('tab_games') || '[]');
  
  gamesData.push({
    username,
    won,
    captures,
    moves,
    date: new Date().toISOString()
  });
  
  // Mantém apenas últimos 100 jogos
  if (gamesData.length > 100) {
    gamesData.shift();
  }
  
  localStorage.setItem('tab_games', JSON.stringify(gamesData));
}