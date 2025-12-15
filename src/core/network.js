// src/core/network.js

const BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) 
  || 'http://twserver.alunos.dcc.fc.up.pt:8134';

// Função genérica para pedidos POST
async function post(endpoint, data) {
  const url = `${BASE_URL}/${endpoint}`;
  console.log(`[NETWORK] POST ${endpoint}`, data);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    // O servidor retorna { error: "..." } se algo correr mal
    if (!response.ok || result.error) {
      throw new Error(result.error || `Erro desconhecido (${response.status})`);
    }

    return result;
  } catch (err) {
    console.error(`[NETWORK] Erro em ${endpoint}:`, err);
    throw err;
  }
}

export const network = {
  // --- AUTENTICAÇÃO E LOBBY ---
  
  async register(nick, password) {
    return post('register', { nick, password });
  },

  async join(group, nick, password, size) {
    return post('join', { group, nick, password, size });
  },

  async leave(nick, password, game) {
    return post('leave', { nick, password, game });
  },


  async roll(nick, password, game) {
    return post('roll', { nick, password, game });
  },

  async notify(nick, password, game, cell) {
    console.log(`[NETWORK] notify: cell=${cell}`);
    return post('notify', { nick, password, game, cell });
  },

  async pass(nick, password, game) {
    return post('pass', { nick, password, game });
  },

  async getRanking(group, size) {
    return post('ranking', { group, size });
  },


  
  // Inicia a escuta de eventos do servidor
  subscribe(game, nick, onMessage, onError) {
    const url = `${BASE_URL}/update?nick=${encodeURIComponent(nick)}&game=${encodeURIComponent(game)}`;
    console.log(`[NETWORK] SSE Connect: ${url}`);
    
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('[NETWORK] SSE Update:', data);
      
      // Se houver erro no stream (ex: Invalid game reference)
      if (data.error) {
        onError(data.error);
        eventSource.close();
        return;
      }
      
      onMessage(data);
    };

    eventSource.onerror = (err) => {
      console.error('[NETWORK] SSE Error:', err);
      onError('Conexão perdida com o servidor.');
      eventSource.close();
    };

    // Retorna uma função para fechar a conexão quando sairmos do jogo
    return () => {
      console.log('[NETWORK] SSE Closing');
      eventSource.close();
    };
  }
};