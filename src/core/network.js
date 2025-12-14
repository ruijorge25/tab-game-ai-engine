// src/core/network.js

const BASE_URL = 'http://twserver.alunos.dcc.fc.up.pt:8008';

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
    // Exemplo: {"nick": "zp", "password": "secret"} -> {}
    return post('register', { nick, password });
  },

  async join(group, nick, password, size) {
    // Exemplo: { ... } -> {"game": "fa93b4..."}
    return post('join', { group, nick, password, size });
  },

  async leave(nick, password, game) {
    return post('leave', { nick, password, game });
  },

  // --- JOGO ---

  async roll(nick, password, game) {
    return post('roll', { nick, password, game });
  },

  // 🔥 CORREÇÃO: Aumentar delay e adicionar retry logic
  async notify(nick, password, game, cell, fromCell = null) {
    // Se fromCell for fornecido, enviamos 2 notifies em sequência
    if (fromCell !== null) {
      try {
        // 1º notify: Seleciona a peça
        console.log(`[NETWORK] notify PARTE 1: Selecionando peça (cell=${fromCell})`);
        await post('notify', { nick, password, game, cell: fromCell });
        
        // 🔥 CORREÇÃO: Aumentar delay de 100ms para 300ms
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (err) {
        // Se o 1º notify falhar, não tenta o 2º
        console.error('[NETWORK] Erro ao selecionar peça:', err.message);
        throw err;
      }
    }
    
    // 2º notify (ou único): Move/seleciona destino
    console.log(`[NETWORK] notify PARTE 2: Movendo para destino (cell=${cell})`);
    
    // 🔥 CORREÇÃO: Retry até 2 vezes se der "roll the stick dice first"
    let attempts = 0;
    const maxAttempts = 2;
    
    while (attempts < maxAttempts) {
      try {
        return await post('notify', { nick, password, game, cell });
      } catch (err) {
        attempts++;
        
        // Se o erro é "roll the stick dice first" E ainda temos tentativas
        if (err.message.includes('roll the stick dice first') && attempts < maxAttempts) {
          console.warn(`[NETWORK] Tentativa ${attempts}/${maxAttempts} falhou. A aguardar 400ms...`);
          await new Promise(resolve => setTimeout(resolve, 400));
          continue; // Tenta novamente
        }
        
        // Se chegou aqui, ou não é esse erro ou esgotaram-se as tentativas
        throw err;
      }
    }
  },

  async pass(nick, password, game) {
    return post('pass', { nick, password, game });
  },

  async getRanking(group, size) {
    return post('ranking', { group, size });
  },

  // --- STREAM DE DADOS (SSE) ---
  
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