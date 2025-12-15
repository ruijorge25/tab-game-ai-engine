import { navigateTo } from '../core/router.js';
import { state } from '../core/state.js';
import { network } from '../core/network.js';
import { showRulesModal, showLeaderboardModal, showModal, closeModal } from '../ui/Modal.js';
import { toast } from '../ui/Toast.js';

export function renderMenuView(container) {
  // Limpa o container para evitar duplicação
  container.innerHTML = '';
  
  const root = document.createElement('div');
  root.className = 'view page-enter';

  // Verifica se já temos credenciais guardadas na sessão
  const { nick, password } = state.session || {};
  const isLoggedIn = !!(nick && password);

  root.innerHTML = `
    <div class="menu-shell">
      
      <section class="menu-panel">
        <div class="card card--soft login-card">
          <h3>Identificação</h3>
          ${!isLoggedIn ? `
            <p class="login-desc">Regista-te ou entra para jogar online.</p>
            <div class="login-form">
              <input type="text" id="username-input" class="input-field" placeholder="Nick" maxlength="20" />
              <input type="password" id="password-input" class="input-field" placeholder="Password" />
              <button class="btn btn-primary" id="btn-login">Entrar / Registar</button>
            </div>
          ` : `
            <div class="user-info">
              <p class="user-greeting">Olá, <strong>${nick}</strong></p>
              <p style="font-size: 0.85rem; opacity: 0.7; margin-top: -8px;">(Sessão Ativa)</p>
              <button class="btn btn-secondary btn-small" id="btn-logout">Sair</button>
            </div>
          `}
        </div>

        <div class="card settings settings-card-shortcuts">
          <h3>Atalhos</h3>
          <div class="shortcuts-list">
            <div class="shortcut-item"><kbd class="kbd">R</kbd><span class="shortcut-desc">Ver Regras</span></div>
            <div class="shortcut-item"><kbd class="kbd">Esc</kbd><span class="shortcut-desc">Fechar Janelas</span></div>
          </div>
        </div>
      </section>

      <section class="menu-panel">
        <div class="logo-bloc">
          <div class="app-logo">TÂB</div>
        </div>
        <div class="card hero-card">
          <div class="hero-actions">
            <button class="btn btn-primary btn-hero" id="btn-play">Jogar</button>
            
            <button class="btn btn-secondary" id="btn-config">Configurações</button>
            <button class="btn btn-secondary" id="btn-rules">Ver Regras</button>
            <button class="btn btn-secondary" id="btn-leaderboard">Classificação</button>
          </div>
        </div>
      </section>

      <section class="menu-panel">
        <div class="card settings settings-scrollable settings-card-quick">
          <h3>Opções de Jogo</h3>
          
          <div class="field">
            <label>Grupo (Avaliação)</label>
            <input type="number" id="q-group" class="input-field" 
                   value="${state.session.group || 34}" 
                   placeholder="Ex: 34" />
            <p class="config-hint">Define o teu grupo para emparelhamento.</p>
          </div>

          <div class="field">
            <label>Tamanho do tabuleiro</label>
            <select id="q-cols" class="select">
              <option value="7">7 colunas</option>
              <option value="9" selected>9 colunas</option>
              <option value="11">11 colunas</option>
              <option value="13">13 colunas</option>
              <option value="15">15 colunas</option>
            </select>
          </div>
          
          <div style="margin-top:20px; text-align:center; opacity:0.6; font-size:0.85rem;">
            Modo: <strong>Configurar ao Jogar</strong>
          </div>
        </div>
      </section>

    </div>
  `;

  // --- LÓGICA DE EVENTOS ---

  // 1. LOGIN
  const handleLogin = async (loginBtn) => {
    const nickVal = root.querySelector('#username-input').value.trim();
    const passVal = root.querySelector('#password-input').value.trim();

    if (!nickVal || !passVal) {
      toast('Preenche o nick e a password.', 'error');
      return;
    }

    try {
      loginBtn.disabled = true;
      loginBtn.textContent = 'A verificar...';

      await network.register(nickVal, passVal);

      state.session.nick = nickVal;
      state.session.password = passVal;
      localStorage.setItem('tab_credentials', JSON.stringify({ nick: nickVal, password: passVal }));

      toast(`Bem-vindo, ${nickVal}!`, 'success');
      
      // Atualiza DOM dinamicamente (SPA)
      const loginCard = root.querySelector('.login-card');
      loginCard.innerHTML = `
        <h3>Identificação</h3>
        <div class="user-info">
          <p class="user-greeting">Olá, <strong>${nickVal}</strong></p>
          <p style="font-size: 0.85rem; opacity: 0.7; margin-top: -8px;">(Sessão Ativa)</p>
          <button class="btn btn-secondary btn-small" id="btn-logout">Sair</button>
        </div>
      `;
      
      // Re-conecta evento de logout
      loginCard.querySelector('#btn-logout').onclick = handleLogout;

    } catch (err) {
      console.error(err);
      toast(err.message || 'Erro no login', 'error');
      loginBtn.disabled = false;
      loginBtn.textContent = 'Entrar / Registar';
    }
  };
  
  const loginBtn = root.querySelector('#btn-login');
  if (loginBtn) {
    loginBtn.onclick = () => handleLogin(loginBtn);
    
    const passwordInput = root.querySelector('#password-input');
    if (passwordInput) {
      passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loginBtn.click();
      });
    }
  }

  // 2. LOGOUT
  const handleLogout = () => {
    state.session.nick = '';
    state.session.password = '';
    state.session.gameId = null;
    localStorage.removeItem('tab_credentials');
    
    toast('Sessão terminada.', 'info');
    
    // Atualiza DOM dinamicamente (SPA)
    const loginCard = root.querySelector('.login-card');
    loginCard.innerHTML = `
      <h3>Identificação</h3>
      <p class="login-desc">Regista-te ou entra para jogar online.</p>
      <div class="login-form">
        <input type="text" id="username-input" class="input-field" placeholder="Nick" maxlength="20" />
        <input type="password" id="password-input" class="input-field" placeholder="Password" />
        <button class="btn btn-primary" id="btn-login">Entrar / Registar</button>
      </div>
    `;
    
    // Re-conecta evento de login
    const newLoginBtn = loginCard.querySelector('#btn-login');
    newLoginBtn.onclick = () => handleLogin(newLoginBtn);
    
    const newPasswordInput = loginCard.querySelector('#password-input');
    newPasswordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') newLoginBtn.click();
    });
  };
  
  const logoutBtn = root.querySelector('#btn-logout');
  if (logoutBtn) {
    logoutBtn.onclick = handleLogout;
  }

  // 3. BOTÃO JOGAR - Abre Modal
  root.querySelector('#btn-play').onclick = () => {
    // Usa state atual (não variáveis antigas)
    const currentlyLoggedIn = !!(state.session.nick && state.session.password);
    showGameModeModal(container, currentlyLoggedIn, state.session.nick, state.session.password);
  };

  // 4. ATUALIZAR INPUTS NO STATE
  const groupInput = root.querySelector('#q-group');
  if (groupInput) {
    groupInput.onchange = (e) => state.session.group = parseInt(e.target.value);
  }
  
  const colsSelect = root.querySelector('#q-cols');
  if (colsSelect) {
    colsSelect.value = state.config.columns || 9;
    colsSelect.onchange = (e) => state.config.columns = parseInt(e.target.value);
  }

  // 5. NAVEGAÇÃO SECUNDÁRIA
  root.querySelector('#btn-config').onclick = () => {
    root.classList.remove('page-enter');
    root.classList.add('page-leave');
    setTimeout(() => navigateTo('config'), 180);
  };

  root.querySelector('#btn-rules').onclick = () => showRulesModal();
  root.querySelector('#btn-leaderboard').onclick = () => showLeaderboardModal();

  // 6. ATALHOS DE TECLADO
  const handleKeyPress = (e) => {
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    
    if (e.key === 'Escape') {
      const modal = document.querySelector('.modal-overlay');
      if (modal) modal.remove();
    }
    if (e.key.toLowerCase() === 'r') {
      showRulesModal();
    }
  };

  document.addEventListener('keydown', handleKeyPress);

  container.appendChild(root);
  
  // Cleanup ao sair da view
  window.cleanupMenuView = () => {
    document.removeEventListener('keydown', handleKeyPress);
  };
}

function showGameModeModal(container, isLoggedIn, nick, password) {
  const modalContent = document.createElement('div');
  modalContent.className = 'game-mode-selector';
  modalContent.innerHTML = `
    <div class="mode-tabs">
      <button class="mode-tab active" data-mode="local">
        <svg style="width:28px;height:28px;margin-bottom:8px;" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12,2A2,2 0 0,1 14,4C14,4.74 13.6,5.39 13,5.73V7H14A7,7 0 0,1 21,14H22A1,1 0 0,1 23,15V18A1,1 0 0,1 22,19H21V20A2,2 0 0,1 19,22H5A2,2 0 0,1 3,20V19H2A1,1 0 0,1 1,18V15A1,1 0 0,1 2,14H3A7,7 0 0,1 10,7H11V5.73C10.4,5.39 10,4.74 10,4A2,2 0 0,1 12,2M7.5,13A2.5,2.5 0 0,0 5,15.5A2.5,2.5 0 0,0 7.5,18A2.5,2.5 0 0,0 10,15.5A2.5,2.5 0 0,0 7.5,13M16.5,13A2.5,2.5 0 0,0 14,15.5A2.5,2.5 0 0,0 16.5,18A2.5,2.5 0 0,0 19,15.5A2.5,2.5 0 0,0 16.5,13Z"/>
        </svg>
        <span>Jogar vs IA</span>
      </button>
      <button class="mode-tab" data-mode="online">
        <svg style="width:28px;height:28px;margin-bottom:8px;" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M7.07,18.28C7.5,17.38 10.12,16.5 12,16.5C13.88,16.5 16.5,17.38 16.93,18.28C15.57,19.36 13.86,20 12,20C10.14,20 8.43,19.36 7.07,18.28M18.36,16.83C16.93,15.09 13.46,14.5 12,14.5C10.54,14.5 7.07,15.09 5.64,16.83C4.62,15.5 4,13.82 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,13.82 19.38,15.5 18.36,16.83M12,6C10.06,6 8.5,7.56 8.5,9.5C8.5,11.44 10.06,13 12,13C13.94,13 15.5,11.44 15.5,9.5C15.5,7.56 13.94,6 12,6M12,11A1.5,1.5 0 0,1 10.5,9.5A1.5,1.5 0 0,1 12,8A1.5,1.5 0 0,1 13.5,9.5A1.5,1.5 0 0,1 12,11Z"/>
        </svg>
        <span>Jogar Online</span>
      </button>
    </div>
    
    <div class="mode-content">
      <!-- MODO LOCAL -->
      <div class="mode-panel active" data-mode="local">
        <h3 style="margin-bottom:20px;">Jogo Local contra IA</h3>
        
        <div class="field">
          <label>Tamanho do Tabuleiro</label>
          <select id="local-cols" class="select">
            <option value="7">7 colunas</option>
            <option value="9" selected>9 colunas</option>
            <option value="11">11 colunas</option>
            <option value="13">13 colunas</option>
            <option value="15">15 colunas</option>
          </select>
        </div>
        
        <div class="field">
          <label>Dificuldade da IA</label>
          <select id="local-ai" class="select">
            <option value="easy">Fácil (Aleatório)</option>
            <option value="medium" selected>Médio (Capturas)</option>
            <option value="hard">Difícil (Estratégico)</option>
          </select>
        </div>
        
        <button class="btn btn-primary btn-large" id="btn-start-local" style="width:100%;margin-top:20px;">
          Começar Jogo
        </button>
      </div>
      
      <!-- MODO ONLINE -->
      <div class="mode-panel" data-mode="online">
        ${!isLoggedIn ? `
          <div style="text-align:center;padding:40px 20px;">
            <svg style="width:64px;height:64px;margin-bottom:20px;opacity:0.6;" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z"/>
            </svg>
            <h3 style="margin-bottom:15px;color:var(--sand);">Login Necessário</h3>
            <p style="opacity:0.8;margin-bottom:25px;line-height:1.6;">
              Para jogar online, é necessário fazer login.<br>
              Por favor, volta ao <strong>Menu Principal</strong> e faz login no painel da esquerda.
            </p>
            <button class="btn btn-secondary btn-large" id="btn-close-modal" style="width:100%;">
              Voltar ao Menu
            </button>
          </div>
        ` : `
          <h3 style="margin-bottom:20px;text-align:center;">Jogar Online</h3>
          
          <div style="background:rgba(203,178,121,0.1);padding:20px;border-radius:12px;margin-bottom:25px;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:15px;">
              <svg style="width:24px;height:24px;opacity:0.7;" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
              </svg>
              <div>
                <div style="font-size:0.85rem;opacity:0.7;">Logado como</div>
                <div style="font-weight:600;color:var(--amber);">${nick}</div>
              </div>
            </div>
            
            <div style="border-top:1px solid rgba(203,178,121,0.2);padding-top:15px;margin-top:15px;">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
                <div>
                  <div style="font-size:0.85rem;opacity:0.7;margin-bottom:5px;">Grupo</div>
                  <div style="font-size:1.1rem;font-weight:600;color:var(--sand);">${state.session.group || 34}</div>
                </div>
                <div>
                  <div style="font-size:0.85rem;opacity:0.7;margin-bottom:5px;">Tabuleiro</div>
                  <div style="font-size:1.1rem;font-weight:600;color:var(--sand);">${state.config.columns || 9} colunas</div>
                </div>
              </div>
            </div>
            
            <div style="margin-top:15px;padding-top:15px;border-top:1px solid rgba(203,178,121,0.2);">
              <p style="font-size:0.85rem;opacity:0.7;text-align:center;">
                Para alterar estas configurações, volta ao Menu Principal
              </p>
            </div>
          </div>
          
          <button class="btn btn-primary btn-large" id="btn-start-online" style="width:100%;">
            <svg style="width:20px;height:20px;margin-right:8px;" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M7.07,18.28C7.5,17.38 10.12,16.5 12,16.5C13.88,16.5 16.5,17.38 16.93,18.28C15.57,19.36 13.86,20 12,20C10.14,20 8.43,19.36 7.07,18.28M18.36,16.83C16.93,15.09 13.46,14.5 12,14.5C10.54,14.5 7.07,15.09 5.64,16.83C4.62,15.5 4,13.82 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,13.82 19.38,15.5 18.36,16.83M12,6C10.06,6 8.5,7.56 8.5,9.5C8.5,11.44 10.06,13 12,13C13.94,13 15.5,11.44 15.5,9.5C15.5,7.56 13.94,6 12,6M12,11A1.5,1.5 0 0,1 10.5,9.5A1.5,1.5 0 0,1 12,8A1.5,1.5 0 0,1 13.5,9.5A1.5,1.5 0 0,1 12,11Z"/>
            </svg>
            Procurar Adversário
          </button>
        `}
      </div>
    </div>
  `;
  
  showModal({
    title: 'Escolher Modo de Jogo',
    className: 'modal-game-mode',
    content: modalContent.outerHTML,
    buttons: [
      { text: 'Cancelar', className: 'btn btn-secondary' }
    ]
  });
  
  // === LÓGICA DAS ABAS ===
  const tabs = document.querySelectorAll('.mode-tab');
  const panels = document.querySelectorAll('.mode-panel');
  
  tabs.forEach(tab => {
    tab.onclick = () => {
      const mode = tab.dataset.mode;
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.querySelector(`.mode-panel[data-mode="${mode}"]`).classList.add('active');
    };
  });
  
  // === MODO LOCAL ===
  const btnStartLocal = document.getElementById('btn-start-local');
  if (btnStartLocal) {
    btnStartLocal.onclick = () => {
      const cols = parseInt(document.getElementById('local-cols').value);
      const aiLevel = document.getElementById('local-ai').value;
      
      state.config.columns = cols;
      state.config.aiLevel = aiLevel;
      state.session.gameId = null; // Garante modo local
      
      closeModal();
      navigateTo('game');
    };
  }
  
  // === MODO ONLINE - VOLTAR AO MENU ===
  const btnCloseModal = document.getElementById('btn-close-modal');
  if (btnCloseModal) {
    btnCloseModal.onclick = () => {
      closeModal();
    };
  }
  
  const btnStartOnline = document.getElementById('btn-start-online');
  if (btnStartOnline) {
    btnStartOnline.onclick = async () => {
      // Usa as configurações já definidas no menu principal
      const originalGroup = state.session.group || 34;
      const sizeVal = state.config.columns || 9;
      


      try {
        btnStartOnline.disabled = true;
        btnStartOnline.innerHTML = '<span class="pulse">A procurar adversário...</span>';
        
        // Envia o originalGroup diretamente
        const data = await network.join(originalGroup, state.session.nick, state.session.password, sizeVal);
        
        if (data.game) {
          state.session.gameId = data.game;
          closeModal();
          navigateTo('game');
        } else {
          throw new Error('Servidor não retornou ID do jogo.');
        }
        
      } catch (err) {
        console.error('[MENU] Erro ao procurar jogo:', err);
        toast(err.message || 'Erro ao entrar no jogo.', 'error');
        btnStartOnline.disabled = false;
        btnStartOnline.textContent = 'Procurar Adversário';
      }
    };
  }
}