import { state } from '../core/state.js';
import { network } from '../core/network.js';

let activeModal = null;
let activeEscHandler = null;


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
      { 
        text: 'Jogar Novamente', 
        className: 'btn btn-primary', 
        onClick: (e) => { 
            if(e && e.preventDefault) e.preventDefault(); 
            if (onPlayAgain) onPlayAgain(); 
        }
      },
      { 
        text: 'Menu', 
        className: 'btn btn-secondary', 
        onClick: (e) => { 
            if(e && e.preventDefault) e.preventDefault(); 
            if (onGoToMenu) onGoToMenu(); 
        }
      }
    ],
    onClose: () => {
      document.querySelectorAll('.confetti-piece').forEach(el => el.remove());

    }
  });
  
  setTimeout(() => animateStats(), 300);
}


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


function formatDate(isoString) {
  const date = new Date(isoString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export function showLeaderboardModal() {
  // 1. Gera o HTML Local (Mantém-se igual)
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

  // 2. Conteúdo da aba "Online" usando WebStorage
  const onlineStats = getOnlineStats();
  
  const onlineHTML = `
    <div id="tab-online" class="leaderboard-tab-content" style="display:none;">
       <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; margin-bottom:20px;">
         <div class="stat-card" style="text-align:center; padding:15px; background:rgba(203,178,121,0.1); border-radius:8px; border:1px solid rgba(203,178,121,0.2);">
           <div style="font-size:0.85rem; opacity:0.7; margin-bottom:5px; color:var(--sand);">Jogos</div>
           <div style="font-size:1.5rem; font-weight:bold; color:var(--sand);">${onlineStats.gamesPlayed}</div>
         </div>
         <div class="stat-card" style="text-align:center; padding:15px; background:rgba(203,178,121,0.1); border-radius:8px; border:1px solid rgba(203,178,121,0.2);">
           <div style="font-size:0.85rem; opacity:0.7; margin-bottom:5px; color:var(--sand);">Vitórias</div>
           <div style="font-size:1.5rem; font-weight:bold; color:var(--green);">${onlineStats.wins}</div>
         </div>
         <div class="stat-card" style="text-align:center; padding:15px; background:rgba(203,178,121,0.1); border-radius:8px; border:1px solid rgba(203,178,121,0.2);">
           <div style="font-size:0.85rem; opacity:0.7; margin-bottom:5px; color:var(--sand);">Derrotas</div>
           <div style="font-size:1.5rem; font-weight:bold; color:var(--red);">${onlineStats.losses}</div>
         </div>
         <div class="stat-card" style="text-align:center; padding:15px; background:rgba(203,178,121,0.1); border-radius:8px; border:1px solid rgba(203,178,121,0.2);">
           <div style="font-size:0.85rem; opacity:0.7; margin-bottom:5px; color:var(--sand);">Taxa de Vitória</div>
           <div style="font-size:1.5rem; font-weight:bold; color:var(--sand);">${onlineStats.winRate}%</div>
         </div>
       </div>

       <div style="margin-bottom:15px;">
         <h4 style="color:var(--sand); opacity:0.9; margin-bottom:10px;">Últimos Jogos Online</h4>
         <table class="leaderboard-table" style="width:100%; border-collapse:collapse;">
           <thead>
             <tr>
               <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(203,178,121,0.2); color:var(--sand); opacity:0.8;">Resultado</th>
               <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(203,178,121,0.2); color:var(--sand); opacity:0.8;">Adversário</th>
               <th style="text-align:right; padding:10px; border-bottom:1px solid rgba(203,178,121,0.2); color:var(--sand); opacity:0.8;">Data</th>
             </tr>
           </thead>
           <tbody>
             ${onlineStats.topGames.map(game => `
               <tr>
                 <td style="padding:10px; border-bottom:1px solid rgba(203,178,121,0.1); color:${game.won ? 'var(--green)' : 'var(--red)'}; font-weight:bold;">
                   ${game.won ? 'Vitória' : 'Derrota'}
                 </td>
                 <td style="padding:10px; border-bottom:1px solid rgba(203,178,121,0.1); color:var(--sand);">${game.opponent}</td>
                 <td style="padding:10px; border-bottom:1px solid rgba(203,178,121,0.1); text-align:right; color:var(--cream); opacity:0.7;">${formatDate(game.date)}</td>
               </tr>
             `).join('')}
             ${onlineStats.topGames.length === 0 ? '<tr><td colspan="3" style="padding:20px; text-align:center; color:var(--cream); opacity:0.5; font-style:italic;">Ainda não jogaste online...</td></tr>' : ''}
           </tbody>
         </table>
       </div>
    </div>
  `;

  // 3. Conteúdo da aba "Ranking Servidor"
  const serverHTML = `
    <div id="tab-server" class="leaderboard-tab-content" style="display:none;">
      <div style="text-align:center; padding:20px;">
        <p style="margin-bottom:15px; color:var(--sand); font-size:0.95em;">Ranking competitivo do servidor</p>
        <div style="display:flex; gap:10px; justify-content:center; margin-bottom:20px; align-items:center;">
          <input type="number" id="server-group" placeholder="Grupo" value="${state.config?.group || 34}" 
                 style="width:100px; padding:8px; background:rgba(203,178,121,0.1); border:1px solid rgba(203,178,121,0.3); color:var(--cream); border-radius:4px;" />
          <input type="number" id="server-size" placeholder="Tamanho" value="${state.config?.columns || 9}" 
                 style="width:100px; padding:8px; background:rgba(203,178,121,0.1); border:1px solid rgba(203,178,121,0.3); color:var(--cream); border-radius:4px;" />
          <button id="btn-fetch-ranking" class="btn btn-secondary" style="padding:8px 16px; font-size:0.9em;">Buscar</button>
        </div>
        <div id="server-ranking-container">
          <p style="opacity:0.5; font-style:italic; font-size:0.9em;">Clica em "Buscar" para ver o ranking do servidor</p>
        </div>
      </div>
    </div>
  `;

  showModal({
    title: 'Estatísticas',
    className: 'modal-leaderboard',
    content: `
      <div class="tabs-header" style="display:flex; gap:10px; margin-bottom:20px; border-bottom:1px solid rgba(203,178,121,0.2); padding-bottom:5px;">
        <button id="btn-tab-local" class="btn-tab active" style="background:none; border:none; color:var(--sand); padding:10px; cursor:pointer; font-weight:bold; border-bottom:2px solid var(--sand);">Local</button>
        <button id="btn-tab-online" class="btn-tab" style="background:none; border:none; color:var(--cream); opacity:0.6; padding:10px; cursor:pointer;">Meus Jogos</button>
        <button id="btn-tab-server" class="btn-tab" style="background:none; border:none; color:var(--cream); opacity:0.6; padding:10px; cursor:pointer;">Ranking Servidor</button>
      </div>
      ${localHTML}
      ${onlineHTML}
      ${serverHTML}
    `,
    buttons: [
      { text: 'Fechar', className: 'btn btn-primary' }
    ]
  });

  // 4. Lógica das Abas
  const btnLocal = document.getElementById('btn-tab-local');
  const btnOnline = document.getElementById('btn-tab-online');
  const btnServer = document.getElementById('btn-tab-server');
  const divLocal = document.getElementById('tab-local');
  const divOnline = document.getElementById('tab-online');
  const divServer = document.getElementById('tab-server');

  // Estilo visual da aba ativa vs inativa
  const activateTab = (activeBtn, activeDiv) => {
    // Esconder todas as abas
    [divLocal, divOnline, divServer].forEach(div => div.style.display = 'none');
    // Resetar estilos de todos os botões
    [btnLocal, btnOnline, btnServer].forEach(btn => {
      btn.style.opacity = '0.6';
      btn.style.borderBottom = '2px solid transparent';
    });
    
    // Ativar a aba selecionada
    activeDiv.style.display = 'block';
    activeBtn.style.opacity = '1';
    activeBtn.style.borderBottom = '2px solid var(--sand)';
  };

  btnLocal.onclick = () => activateTab(btnLocal, divLocal);
  btnOnline.onclick = () => activateTab(btnOnline, divOnline);
  btnServer.onclick = () => activateTab(btnServer, divServer);

  // 5. Buscar Rankings do Servidor
  const btnFetchRanking = document.getElementById('btn-fetch-ranking');
  const rankingContainer = document.getElementById('server-ranking-container');
  
  if (btnFetchRanking) {
    btnFetchRanking.onclick = async () => {
      const group = parseInt(document.getElementById('server-group').value);
      const size = parseInt(document.getElementById('server-size').value);
      
      if (!group || !size) {
        rankingContainer.innerHTML = '<p style="color:var(--red); font-size:0.9em;">Por favor, preenche grupo e tamanho</p>';
        return;
      }
      
      rankingContainer.innerHTML = '<p style="opacity:0.7; font-size:0.9em;">A carregar rankings...</p>';
      
      try {
        const data = await network.getRanking(group, size);
        
        if (!data.ranking || data.ranking.length === 0) {
          rankingContainer.innerHTML = '<p style="opacity:0.5; font-style:italic; font-size:0.9em;">Sem rankings para este grupo/tamanho ainda</p>';
          return;
        }
        
        const currentNick = state.session?.nick || localStorage.getItem('tab_username');
        
        rankingContainer.innerHTML = `
          <table class="leaderboard-table" style="width:100%; border-collapse:collapse; margin-top:10px;">
            <thead>
              <tr>
                <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(203,178,121,0.3); color:var(--sand); font-size:0.85em;">#</th>
                <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(203,178,121,0.3); color:var(--sand); font-size:0.85em;">Nick</th>
                <th style="text-align:center; padding:10px; border-bottom:1px solid rgba(203,178,121,0.3); color:var(--sand); font-size:0.85em;">Vitórias</th>
                <th style="text-align:center; padding:10px; border-bottom:1px solid rgba(203,178,121,0.3); color:var(--sand); font-size:0.85em;">Jogos</th>
                <th style="text-align:center; padding:10px; border-bottom:1px solid rgba(203,178,121,0.3); color:var(--sand); font-size:0.85em;">Taxa</th>
              </tr>
            </thead>
            <tbody>
              ${data.ranking.map((player, index) => {
                const winRate = player.games > 0 ? Math.round((player.victories / player.games) * 100) : 0;
                const isCurrentUser = player.nick === currentNick;
                return `
                  <tr style="background:${isCurrentUser ? 'rgba(203,178,121,0.15)' : 'transparent'}; transition: background 0.2s;">
                    <td style="padding:10px; border-bottom:1px solid rgba(203,178,121,0.1); color:var(--sand); font-weight:bold; font-size:0.9em;">${index + 1}</td>
                    <td style="padding:10px; border-bottom:1px solid rgba(203,178,121,0.1); color:var(--cream); ${isCurrentUser ? 'font-weight:bold;' : ''} font-size:0.9em;">${player.nick}${isCurrentUser ? ' (tu)' : ''}</td>
                    <td style="padding:10px; border-bottom:1px solid rgba(203,178,121,0.1); text-align:center; color:var(--green); font-weight:bold; font-size:0.9em;">${player.victories}</td>
                    <td style="padding:10px; border-bottom:1px solid rgba(203,178,121,0.1); text-align:center; color:var(--sand); font-size:0.9em;">${player.games}</td>
                    <td style="padding:10px; border-bottom:1px solid rgba(203,178,121,0.1); text-align:center; color:var(--sand); font-size:0.9em;">${winRate}%</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          <p style="margin-top:15px; opacity:0.6; font-size:0.8em; text-align:center;">Top 10 jogadores • Grupo ${group} • Tabuleiro ${size}x4</p>
        `;
        
      } catch (err) {
        console.error('[Modal] Erro ao buscar ranking:', err);
        const errorMsg = err.message || 'Não foi possível carregar o ranking';
        rankingContainer.innerHTML = `<p style="color:var(--red); font-size:0.9em;">Erro: ${errorMsg}</p>`;
      }
    };
  }
}


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

/* Salva resultado de jogo no localStorage (APENAS LOCAL) */
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


function getOnlineStats() {
  const username = localStorage.getItem('tab_username') || null;
  const onlineGames = JSON.parse(localStorage.getItem('tab_online_games') || '[]');
  
  // Filtra jogos do usuário atual
  const userGames = username 
    ? onlineGames.filter(g => g.username === username)
    : onlineGames;
  
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
    topGames: userGames.sort((a, b) => new Date(b.date) - new Date(a.date))
  };
}

/* Salva resultado de jogo online no WebStorage */
export function saveOnlineResult({ won, opponent }) {
  const username = localStorage.getItem('tab_username') || state.session?.nick || 'Anônimo';
  const onlineGames = JSON.parse(localStorage.getItem('tab_online_games') || '[]');
  
  onlineGames.push({
    username,
    won,
    opponent: opponent || 'Adversário',
    date: new Date().toISOString()
  });
  
  // Mantém apenas últimos 200 jogos
  if (onlineGames.length > 200) {
    onlineGames.shift();
  }
  
  localStorage.setItem('tab_online_games', JSON.stringify(onlineGames));
}