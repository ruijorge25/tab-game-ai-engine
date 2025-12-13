export const state = {
  currentView: 'menu',
  // Dados do utilizador e sessão atual
  session: {
    nick: '',
    password: '',
    gameId: null, // O hash do jogo (ex: "fa93b4...")
    group: 34    
  },
  config: { 
    columns: 9, 
    theme: 'desert',
    audio: { musicVolume: 0.3, musicOn: false, sfxOn: true },
    animations: true
  },

  game: { 
    serverState: null 
  }
};

export function initState() {
  // Tenta recuperar nick/pass do localStorage para conveniência
  const saved = localStorage.getItem('tab_credentials');
  if (saved) {
    const creds = JSON.parse(saved);
    state.session.nick = creds.nick;
    state.session.password = creds.password;
  }
  
  // Garante que columns tem valor válido
  if (!state.config.columns) {
    state.config.columns = 9;
  }
  
  console.log('Estado inicializado', state);
}