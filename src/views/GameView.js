import { navigateTo } from '../core/router.js';
import { state } from '../core/state.js';
import { network } from '../core/network.js';
import { Board } from '../ui/Board.js';
import { Dice, setDiceValue, createGoldenParticlesExported } from '../ui/Dice.js';
import { toast } from '../ui/Toast.js';
import { 
  showVictoryModal, 
  saveGameResult, 
  showRulesModal, 
  showModal,
  closeModal
} from '../ui/Modal.js';
import { 
  playSound, 
  toggleMusic, 
  toggleSFX, 
  setMusicVolume 
} from '../core/audio.js';

import { createEngineAdapter } from '../game/engine.adapter.js';
import { createTabEngine } from '../game/engine.tab.js';
import { createOnlineEngine } from '../game/engine.online.js'; // NOVO
import { getBestMoveWithHint, findBestMove } from '../game/ai.js';

export function renderGameView(container) {
  let engine;
  let isOnline = false;
  let unsubscribeSSE = null;

  // 1. DECISÃO DE MOTOR
  // Se existir um ID de jogo na sessão, assumimos Modo Online
  if (state.session.gameId) {
    isOnline = true;
    engine = createOnlineEngine();
    engine.init(state.session.gameId, state.session.nick, state.session.password, state.config.columns || 9);
    console.log('[GameView] Modo Online Ativo. GameID:', state.session.gameId, 'Tamanho:', state.config.columns);
  } else {
    isOnline = false;
    engine = createEngineAdapter(
      createTabEngine({ columns: state.config.columns })
    );
    console.log('[GameView] Modo Local Ativo.');
  }
  
  // Nome do jogador (Sessão ou LocalStorage)
  const username = isOnline ? state.session.nick : (localStorage.getItem('tab_username') || 'Utilizador');

  const root = document.createElement('div');
  root.className = 'game-scene';

  // 2. HTML (Mantendo a estrutura original com Popovers)
  root.innerHTML = `
    <header class="hud">
      <div class="logo">Tâb</div>
      <div class="turn-display">
        <div class="player-indicator" id="player-human">
          <div class="player-icon player-icon-yellow"></div>
          <span class="player-label">${username}</span>
          <div class="piece-counter" id="counter-human">-</div>
        </div>
        <div class="turn-text"><span id="hud-turn">Aguardando...</span></div>
        <div class="player-indicator" id="player-opponent">
          <div class="player-icon player-icon-blue"></div>
          <span class="player-label">${isOnline ? 'Adversário' : 'Computador'}</span>
          <div class="piece-counter" id="counter-ai">-</div>
        </div>
      </div>
      <div class="actions">
      
        <button class="btn-icon" id="btn-toggle-sound" title="Definições de Som">
          <svg class="icon-svg icon-sound-on" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          </svg>
          <svg class="icon-svg icon-sound-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <line x1="23" y1="9" x2="17" y2="15"></line>
            <line x1="17" y1="9" x2="23" y2="15"></line>
          </svg>
        </button>
        
        <button class="btn btn-secondary btn-small" id="btn-pass" style="display:none; margin-right:8px;">Passar</button>

        ${!isOnline ? `
        <button class="btn-icon" id="btn-hints" title="Dicas">
          <svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18h6"></path>
            <path d="M10 22h4"></path>
            <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1.33.47 2.48 1.5 3.5.76.76 1.23 1.52 1.41 2.5"></path>
          </svg>
        </button>` : ''}

        <button class="btn-icon" id="btn-shortcuts" title="Atalhos de Teclado">
          <svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
            <line x1="6" y1="8" x2="6.01" y2="8"></line>
            <line x1="10" y1="8" x2="10.01" y2="8"></line>
            <line x1="14" y1="8" x2="14.01" y2="8"></line>
            <line x1="18" y1="8" x2="18.01" y2="8"></line>
            <line x1="8" y1="12" x2="8.01" y2="12"></line>
            <line x1="12" y1="12" x2="12.01" y2="12"></line>
            <line x1="16" y1="12" x2="16.01" y2="12"></line>
            <line x1="7" y1="16" x2="17" y2="16"></line>
          </svg>
        </button>
        <button class="btn-icon" id="btn-rules" title="Regras do Jogo">
          <svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
        </button>
        <button class="btn-icon btn-exit" id="btn-exit" title="Sair do Jogo">
          <svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
        </button>
      </div>
    </header>

    <main class="stage">
      <section class="board-pane"></section>
      <aside class="right-pane">
        <div class="dice-card" id="dice-holder"></div>
      </aside>
    </main>
  `;

  const boardPane = root.querySelector('.board-pane');
  const diceHolder = root.querySelector('#dice-holder');
  const btnPass = root.querySelector('#btn-pass');

  let diceBtn; 

  // Contadores de estatísticas (Usados principalmente no modo Local)
  let humanMoves = 0;
  let humanCaptures = 0;
  let aiMoves = 0;
  let aiCaptures = 0;

  // 3. RECUPERAR POPOVER DE ÁUDIO (Código Original)
  const audioPopover = document.createElement('div');
  audioPopover.id = 'game-audio-popover';
  audioPopover.className = 'audio-popover';
  audioPopover.style.display = 'none'; 
  audioPopover.style.position = 'absolute'; 
  audioPopover.innerHTML = `
    <div class="audio-control">
      <label>Música</label>
      <button 
        id="game-btn-mute-music" 
        class="toggle-switch ${state.config.audio.musicOn ? 'is-on' : ''}"
        aria-label="Ligar/Desligar Música"
      ></button>
    </div>
    <div 
      class="audio-control" 
      id="game-volume-control-wrapper" 
      style="display: ${state.config.audio.musicOn ? 'grid' : 'none'};"
    >
      <label>Volume</label>
      <input 
        type="range" 
        id="game-slider-music-vol" 
        min="0" max="1" step="0.05" 
        value="${state.config.audio.musicVolume}"
      />
    </div>
    <div class="audio-control">
      <label>SFX</label>
      <button 
        id="game-btn-mute-sfx" 
        class="toggle-switch ${state.config.audio.sfxOn ? 'is-on' : ''}"
        aria-label="Ligar/Desligar Efeitos"
      ></button>
    </div>
  `;
  root.appendChild(audioPopover); 

  const btnMuteMusic = audioPopover.querySelector('#game-btn-mute-music');
  const sliderVolume = audioPopover.querySelector('#game-slider-music-vol');
  const sliderWrapper = audioPopover.querySelector('#game-volume-control-wrapper');
  const btnMuteSFX = audioPopover.querySelector('#game-btn-mute-sfx');

  // Lógica do Popover de Áudio
  btnMuteMusic.onclick = (e) => {
    e.stopPropagation(); 
    toggleMusic();
    btnMuteMusic.classList.toggle('is-on', state.config.audio.musicOn);
    sliderWrapper.style.display = state.config.audio.musicOn ? 'grid' : 'none';
    updateSoundIcon(); 
  };

  btnMuteSFX.onclick = (e) => {
    e.stopPropagation();
    toggleSFX();
    btnMuteSFX.classList.toggle('is-on', state.config.audio.sfxOn);
    updateSoundIcon();
  };

  sliderVolume.oninput = (e) => {
    e.stopPropagation();
    setMusicVolume(e.target.value);
  };
  
  sliderVolume.onclick = (e) => e.stopPropagation();

  // 4. LÓGICA DE JOGO (Híbrida)
  
  let selectedPieceOnline = null; // Guarda a peça selecionada no modo online
  let pendingMoveOnline = false; // Flag para evitar jogadas automáticas
  let serverStep = 'from'; // Rastreia o step do servidor ('from' ou 'to')

  // Proteção contra race condition (cliques duplos)
  let isProcessingMove = false;

  // Função Unificada de Interação (Select/Move)
  async function handleInteraction(r, c) {
    // 🔥 PROTEÇÃO CRÍTICA
    if (isProcessingMove) {
      console.log('[GameView] Movimento em processamento, aguarde...');
      return;
    }
    
    if (isOnline) {
      // ONLINE: Sistema de seleção em duas etapas (LOCAL-FIRST)
      
      // ========== MODO ONLINE: Seleção Local + Envio Único ==========
      
      // ETAPA 1: Nenhuma peça selecionada ainda
      if (!selectedPieceOnline) {
        const boardData = engine.getBoard();
        const piece = boardData[r]?.[c];
        
        // Validação: Tem de ser minha peça
        if (!piece || piece.player !== 1) {
          toast('Selecione uma das suas peças', 'warning');
          return;
        }
        
        // Calcula movimentos válidos LOCALMENTE (não envia nada ao servidor)
        const validMoves = engine.getValidMoves ? engine.getValidMoves(r, c) : [];
        console.log('[GameView] Selecionando peça LOCAL:', r, c, 'Movimentos:', validMoves);
        
        if (validMoves.length === 0) {
          toast('Esta peça não pode mover com este dado', 'warning');
          return;
        }
        
        // Guarda peça e mostra destinos (TUDO LOCAL, SEM SERVIDOR)
        selectedPieceOnline = { row: r, col: c };
        board.highlightSelection(r, c, validMoves);
        
        return; // Aguarda clique no destino
      }
      
      // ETAPA 2: Já tem peça selecionada, agora escolhe destino
      else {
        // Verifica se clicou num destino válido
        const currentHighlights = board.el.querySelectorAll('.is-target');
        const isValidTarget = [...currentHighlights].some(cell => {
          return parseInt(cell.dataset.r) === r && parseInt(cell.dataset.c) === c;
        });
        
        // CASO A: Clicou na mesma peça → Desseleciona
        if (selectedPieceOnline.row === r && selectedPieceOnline.col === c) {
          console.log('[GameView] Desselecionando peça');
          board.clearHighlights();
          selectedPieceOnline = null;
          return;
        }
        
        // CASO B: Clicou num destino válido → ENVIA JOGADA COMPLETA
        if (isValidTarget) {
          const fromR = selectedPieceOnline.row;
          const fromC = selectedPieceOnline.col;
          const toR = r;
          const toC = c;
          
          console.log(`[GameView] Confirmando jogada: (${fromR},${fromC}) → (${toR},${toC})`);
          
          isProcessingMove = true; // ← Bloqueia
          root.classList.add('waiting-server');
          board.clearHighlights();
          
          try {
            // Envia jogada completa; mensagens de erro serão confirmadas pelo servidor
            await engine.movePiece(fromR, fromC, toR, toC);
            selectedPieceOnline = null;
          } catch (err) {
            // Evitar mostrar erro imediato para não conflitar com aceite posterior do servidor
            console.error('[GameView] Erro ao enviar jogada:', err);
            selectedPieceOnline = null;
          } finally {
            isProcessingMove = false; // ← Desbloqueia SEMPRE
            root.classList.remove('waiting-server');
          }
          
          return;
        }
        
        // CASO C: Clicou noutra peça → Troca seleção
        const boardData = engine.getBoard();
        const newPiece = boardData[r]?.[c];
        
        if (newPiece && newPiece.player === 1) {
          console.log('[GameView] Trocando seleção para nova peça');
          board.clearHighlights();
          selectedPieceOnline = null;
          handleInteraction(r, c); // Recursão para selecionar nova peça
          return; // 🔥 CRÍTICO: Para execução aqui!
        } else {
          // Clicou numa casa inválida (nem peça nem destino)
          toast('Clique num destino válido ou noutra peça', 'warning');
        }
      }
      
    } else {
      // LOCAL: Executa lógica original
      localInteractionMove(r, c);
    }
  }

  const board = Board({
    engine,
    onSelect: (r, c) => handleInteraction(r, c),
    onMove: (r, c) => handleInteraction(r, c)
  });
  boardPane.appendChild(board.el);

  // Dado Unificado
  const dice = Dice(async () => {
    try {
      if (isOnline) {
        await engine.rollDice();
        return null; // Online espera SSE
      } else {
        const val = engine.rollDice();
        updateHUDLocal();
        localCheckAutoPass(1);
        return val;
      }
    } catch (err) {
      toast(err.message, 'error');
      return engine.getDice();
    }
  });

  // Listener no holder do dado: evitar mensagens enquanto aguardamos pelo servidor
  diceHolder.addEventListener('click', () => {
    if (root.classList.contains('waiting-server')) return;
    if (!diceBtn) return;
    if (diceBtn.classList.contains('is-disabled')) {
      const isMyTurn = engine.getCurrentPlayer() === 1;
      const diceObj = (typeof engine.getDiceObj === 'function') ? engine.getDiceObj() : null;
      const hasDice = engine.getDice() != null;
      const extraTurn = isOnline && !!diceObj && diceObj.keepPlaying === true;
      if (!isMyTurn) {
        toast(isOnline ? 'Não é a sua vez.' : 'Aguarde, é a vez do computador.', 'info');
      } else if (hasDice && !extraTurn) {
        // Só avisa para concluir jogada se não houver jogada extra (4 ou 6)
        toast('Tem de concluir a jogada antes de rolar.', 'warning');
      }
      // Se houver extraTurn, não mostra aviso — o botão deve estar ativo para re-rolar
    }
  });

  diceHolder.appendChild(dice);
  diceBtn = dice.querySelector('button');
  dice.dataset.lastValue = ''; // 🔥 INICIALIZA AQUI

  // 5. UPDATE ONLINE (SSE)
  function onServerUpdate(data) {
    engine.update(data);
    
    // Atualiza step do servidor
    if (data.step) {
      serverStep = data.step;
    }
    
    board.render();
    
    // Remove cursor de loading
    root.classList.remove('waiting-server');
    
    // 🔥 Limpa seleção local quando servidor responde
    if (selectedPieceOnline) {
      console.log('[SSE] Limpando seleção local após resposta do servidor');
      board.clearHighlights();
      selectedPieceOnline = null;
    }

    // Atualiza Dado
    const diceObj = engine.getDiceObj();
    const newDiceValue = diceObj ? diceObj.value : null;
    
    // Detecta se o dado foi lançado (mudou de null para valor)
    const prevDiceValue = dice.dataset.lastValue ? parseInt(dice.dataset.lastValue) : null;
    const diceWasRolled = (prevDiceValue === null && newDiceValue !== null);
    
    setDiceValue(dice, newDiceValue);
    
    // Se o dado foi lançado, faz animações
    if (diceWasRolled && state.config.animations !== false) {
      const sticks = dice.querySelector('.dice-sticks');
      sticks.classList.add('dice-bounce');
      setTimeout(() => sticks.classList.remove('dice-bounce'), 600);
      
      // Partículas para valores especiais
      if (newDiceValue === 6 || newDiceValue === 4 || newDiceValue === 1) {
        createGoldenParticlesExported(dice);
      }
    }
    
    // Guarda o valor atual para próxima comparação
    dice.dataset.lastValue = newDiceValue ?? '';

    // Atualiza HUD Online
    updateHUDOnline(data);
    
    // Atualiza contadores de peças capturadas
    updateCaptureCounters();

    // Fim de Jogo
    if (data.winner) {
      const isMe = (data.winner === state.session.nick);
      triggerEndGame(isMe ? 1 : 2, data.winner);
    }
  }

 function updateHUDOnline(data) {
    // 1. Atualiza Texto e Indicadores de Turno
    const isMyTurn = (data.turn === state.session.nick);
    root.querySelector('#hud-turn').textContent = isMyTurn ? 'Sua Vez' : `Vez de ${data.turn}`;
    
    if (data.players) {
      const opponentNick = Object.keys(data.players).find(nick => nick !== state.session.nick);
      if (opponentNick) {
        root.querySelector('#player-opponent .player-label').textContent = opponentNick;
      }
    }
    
    root.querySelector('#player-human').classList.toggle('active-player', isMyTurn);
    root.querySelector('#player-opponent').classList.toggle('active-player', !isMyTurn);
    
    // 2. Lógica Base do Botão de Dado
    // Ativa se for minha vez E (não há dado OU tenho jogada extra e estou na seleção de origem)
    // Permite re-lançar sempre que há jogada extra (1,4,6),
    // independentemente do `data.step` atual.
    const canRoll = isMyTurn && (!data.dice || (data.dice.keepPlaying === true));
    
    if (diceBtn) {
      const disabled = !canRoll;
      diceBtn.classList.toggle('is-disabled', disabled);
      diceBtn.style.pointerEvents = disabled ? 'none' : 'auto';
      diceBtn.style.opacity = disabled ? '0.6' : '1';
      if (!disabled) diceBtn.classList.add('dice-ready');
      else diceBtn.classList.remove('dice-ready');
    }

    // 3. Lógica do Botão Passar e Auto-Pass
    // Determinar jogadas disponíveis apenas via API dedicada quando existir
    let hasMoves = true;
    if (typeof engine.hasAnyValidMove === 'function') {
      hasMoves = !!engine.hasAnyValidMove();
    }
    const diceValue = data.dice?.value;
    const keepPlaying = data.dice?.keepPlaying; // (1, 4, 6)
    
    btnPass.style.display = 'block';
    
    let canPass = false;
    let shouldAutoPass = false;
    let autoPassReason = '';
    
    if (data.mustPass && data.mustPass === state.session.nick) {
        // CASO A: Servidor manda passar
        canPass = true;
        shouldAutoPass = true;
        autoPassReason = 'Sem jogadas disponíveis. Passando a vez...';

    } else if (isMyTurn && data.dice && !keepPlaying && data.step === 'from' && !hasMoves) {
      // Sem jogada extra e sem movimentos confirmados
      canPass = true;
      shouldAutoPass = false;

    } else if (isMyTurn && data.dice && !keepPlaying && data.step === 'from') {
        // CASO C: Bloqueado a meio do jogo sem extra turn (dado 2 ou 3)
        // Aqui o jogador tem de passar manualmente
        canPass = true;
        shouldAutoPass = false;

    } else if (!isMyTurn) {
        canPass = false;
    } else if (!data.dice) {
        canPass = false;
    } else {
        // Tenho dado e posso jogar
        canPass = false;
    }
    
    // Aplica estado ao botão Passar
    if (canPass) {
        btnPass.classList.remove('is-disabled');
        btnPass.style.pointerEvents = 'auto';
        btnPass.style.opacity = '1';
        btnPass.onclick = () => engine.passTurn();
        
        if (shouldAutoPass) {
            toast(autoPassReason, 'info');
            // Se vai passar automático, bloqueia o dado para não haver cliques duplos
            if (diceBtn) diceBtn.classList.add('is-disabled');
            setTimeout(() => {
                engine.passTurn();
            }, 1500);
        }
    } else {
        btnPass.classList.add('is-disabled');
        btnPass.style.pointerEvents = 'none';
        btnPass.style.opacity = '0.5';
        btnPass.onclick = null;
    }
    
    updateSoundIcon();
  }
  function updateCaptureCounters() {
    if (!isOnline) return;
    
    // Conta peças no tabuleiro para cada jogador
    const board = engine.getBoard();
    const cols = engine.getColumns ? engine.getColumns() : 9;
    let player1Pieces = 0;
    let player2Pieces = 0;
    
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = board[r][c];
        if (cell) {
          if (cell.player === 1) player1Pieces++;
          else if (cell.player === 2) player2Pieces++;
        }
      }
    }
    
    // Calcula capturas (inicialmente tinha 9, agora tem X)
    const player1Captured = 9 - player1Pieces;
    const player2Captured = 9 - player2Pieces;
    
    // Atualiza UI (eu sou sempre player-human, adversário é player-opponent)
    root.querySelector('#counter-human').textContent = player2Captured;
    root.querySelector('#counter-ai').textContent = player1Captured;
  }

  // 6. UPDATE LOCAL (Lógica Original)
  function localInteractionMove(r, c) {
    if (engine.getCurrentPlayer() !== 1) return;
    const moves = engine.getValidMoves(r, c);
    if (moves.length > 0) {
      board.highlightSelection(r, c, moves);
      return;
    }
    try {
      const res = engine.moveSelectedTo(r, c);
      humanMoves++; 
      board.clearHighlights();
      board.render();
      if (res?.captured) {
        toast('Captura!', 'success');
        playSound('goodcapture'); 
        humanCaptures++; 
      }
      if (engine.checkWinner()) { triggerEndGame(engine.checkWinner(), 'Computador'); return; }
      updateHUDLocal();
      if (res?.extraTurn) {
        toast('Jogada extra!', 'success');
      } else {
        setTimeout(runLocalAITurn, 1000);
      }
    } catch (err) {
      board.clearHighlights();
    }
  }

  async function runLocalAITurn() {
    if (engine.getCurrentPlayer() !== 2) return;
    board.clearHighlights();
    updateHUDLocal();
    await new Promise(r => setTimeout(r, 1500));
    try {
      const diceVal = engine.rollDice();
      toast(`Computador rolou ${diceVal}!`, 'info');
      playSound('flip');
      updateHUDLocal();
      await new Promise(r => setTimeout(r, 800));

      if (localCheckAutoPass(2)) return;

      const chosenMove = findBestMove(state.config.aiLevel, engine);
      if (!chosenMove) { 
        engine.passTurn(); updateHUDLocal(); return;
      }
      
      engine.getValidMoves(chosenMove.piece.row, chosenMove.piece.col); 
      const res = engine.moveSelectedTo(chosenMove.target.row, chosenMove.target.col);
      aiMoves++;
      board.render();
      if (res?.captured) {
        toast('Computador capturou!', 'success');
        playSound('badcapture'); 
        aiCaptures++;
      }
      if (engine.checkWinner()) { triggerEndGame(2, 'Computador'); return; }
      updateHUDLocal();
      if (res.extraTurn) runLocalAITurn();

    } catch (err) {
      engine.passTurn(); updateHUDLocal();
    }
  }

  function localCheckAutoPass(player) {
    if (engine.getCurrentPlayer() === player && engine.getDice() !== null && engine.canPass()) {
      const pName = player === 1 ? 'Você' : 'Computador';
      toast(`${pName} sem jogadas. A passar...`, 'info');
      setTimeout(() => {
        engine.passTurn();
        updateHUDLocal();
        if (player === 1) runLocalAITurn();
      }, 1500);
      return true;
    }
    return false;
  }

  function updateHUDLocal() {
    const player = engine.getCurrentPlayer();
    const turn = player === 1 ? username : 'Computador'; 
    root.querySelector('#hud-turn').textContent = `Vez de ${turn}`;
    
    root.querySelector('#player-human').classList.toggle('active-player', player === 1);
    root.querySelector('#player-opponent').classList.toggle('active-player', player === 2);
    
    const counts = engine.getPieceCounts();
    root.querySelector('#counter-human').textContent = counts.player1;
    root.querySelector('#counter-ai').textContent = counts.player2;
    
    setDiceValue(dice, engine.getDice());
    
    if (diceBtn) {
      const isDisabled = (player !== 1 || engine.getDice() != null);
      diceBtn.classList.toggle('is-disabled', isDisabled);
      diceBtn.style.pointerEvents = isDisabled ? 'none' : 'auto';
      diceBtn.style.opacity = isDisabled ? '0.6' : '1';
      if (!isDisabled) diceBtn.classList.add('dice-ready');
      else diceBtn.classList.remove('dice-ready');
    }
    updateSoundIcon();
  }

  // Helper para atualizar ícone do som
  function updateSoundIcon() {
    const btnSound = root.querySelector('#btn-toggle-sound');
    if (btnSound) {
      const isMuted = !state.config.audio.musicOn && !state.config.audio.sfxOn;
      btnSound.classList.toggle('is-muted', isMuted);
    }
  }

  // 7. LISTENERS DE BOTÕES E POPOVERS (Restaurados)

  const btnSound = root.querySelector('#btn-toggle-sound');
  let popoverOpen = false;

  const handleClickOutside = (e) => {
    if (popoverOpen && !audioPopover.contains(e.target) && !btnSound.contains(e.target)) {
      audioPopover.style.display = 'none';
      popoverOpen = false;
      document.removeEventListener('click', handleClickOutside, true);
    }
  };

  btnSound.onclick = (e) => {
    e.stopPropagation();
    if (popoverOpen) {
      audioPopover.style.display = 'none';
      popoverOpen = false;
      document.removeEventListener('click', handleClickOutside, true);
    } else {
      const rect = btnSound.getBoundingClientRect();
      const rootRect = container.getBoundingClientRect(); 
      audioPopover.style.top = (rect.bottom - rootRect.top + 10) + 'px'; 
      audioPopover.style.right = (rootRect.right - rect.right) + 'px'; 
      audioPopover.style.display = 'flex';
      popoverOpen = true;
      document.addEventListener('click', handleClickOutside, true);
    }
  };

  // Botão Sair (Híbrido)
  root.querySelector('#btn-exit').onclick = () => {
    showModal({
      title: isOnline ? 'Desistir do Jogo' : 'Sair do Jogo', 
      content: '<p>Tem a certeza que quer sair? <strong>Isto contará como uma derrota.</strong></p>',
      buttons: [
        { 
          text: isOnline ? 'Sim, Desistir' : 'Sim, Sair', 
          className: 'btn btn-primary', 
          onClick: async () => {
            if (isOnline) {
               await engine.giveUp();
               if (unsubscribeSSE) unsubscribeSSE();
            } else {
               triggerEndGame(2, 'Computador'); // Local: Desistir = Perder
            }
            state.session.gameId = null;
            navigateTo('menu'); // Navega depois de fechar
          }
        },
        { text: 'Cancelar', className: 'btn btn-secondary' }
      ]
    });
  };

  root.querySelector('#btn-rules').onclick = () => showRulesModal();

  if (!isOnline) {
    root.querySelector('#btn-hints').onclick = () => {
        if (engine.getCurrentPlayer() !== 1) { toast('Não é a sua vez.', 'warning'); return; }
        if (engine.getDice() == null) { toast('Lance o dado primeiro.', 'warning'); return; }
        board.clearHighlights();
        const hint = getBestMoveWithHint(engine);
        if (!hint || !hint.move) { toast('Sem jogadas.', 'info'); return; }
        const { move, reason } = hint;
        // Destaque visual
        engine.getValidMoves(move.piece.row, move.piece.col);
        board.highlightSelection(move.piece.row, move.piece.col, [move.target]);
        toast(`Dica: ${reason}`, 'success');
    };
  }
  
  // Popover de Atalhos (Código Original)
  root.querySelector('#btn-shortcuts').onclick = (e) => {
    e.stopPropagation();
    const existing = document.querySelector('.shortcuts-popover');
    if (existing) { existing.remove(); return; }
    
    const popover = document.createElement('div');
    popover.className = 'shortcuts-popover';
    popover.innerHTML = `
      <h4 style="color:var(--sand);font-size:0.95rem;margin-bottom:12px;font-weight:700;text-align:center;">Atalhos de Teclado</h4>
      <div class="shortcuts-list">
        <div class="shortcut-item"><kbd class="kbd">Espaço</kbd><span class="shortcut-desc">Lançar Dado</span></div>
        <div class="shortcut-item"><kbd class="kbd">H</kbd><span class="shortcut-desc">Ver Dica</span></div>
        <div class="shortcut-item"><kbd class="kbd">R</kbd><span class="shortcut-desc">Regras</span></div>
        <div class="shortcut-item"><kbd class="kbd">Esc</kbd><span class="shortcut-desc">Sair</span></div>
      </div>
    `;
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    popover.style.position = 'fixed';
    popover.style.top = `${rect.bottom + 10}px`;
    popover.style.right = `${window.innerWidth - rect.right}px`;
    document.body.appendChild(popover);
    
    setTimeout(() => {
      const closeHandler = (ev) => {
        if (!popover.contains(ev.target) && ev.target !== btn) {
          popover.remove();
          document.removeEventListener('click', closeHandler, true);
        }
      };
      document.addEventListener('click', closeHandler, true);
    }, 100);
  };

  const handleKeyPress = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const key = e.key.toLowerCase();
    if (key === ' ' && !e.repeat) {
      if (engine.getCurrentPlayer() === 1 && engine.getDice() === null && diceBtn) {
        e.preventDefault();
        diceBtn.click();
      }
    }
    if (key === 'escape') {
        const modal = document.querySelector('.modal-overlay');
        if (modal) closeModal();
        else root.querySelector('#btn-exit').click();
    }
    if (key === 'h' && !isOnline) root.querySelector('#btn-hints').click();
    if (key === 'r') showRulesModal();
  };
  document.addEventListener('keydown', handleKeyPress);

  // 8. FIM DE JOGO
  function triggerEndGame(winnerCode, winnerName) {
    const isWin = (winnerCode === 1);
    playSound(isWin ? 'victory' : 'defeat');
    
    // Stats para Local (no online o servidor gere)
    const stats = {
      won: isWin,
      captures: humanCaptures,
      moves: humanMoves
    };
    
    if (unsubscribeSSE) unsubscribeSSE();
    state.session.gameId = null;

    if (!isOnline) saveGameResult(stats);

    setTimeout(() => {
      showVictoryModal({ 
        winner: isOnline ? winnerName : winnerCode, 
        stats: isOnline ? {} : stats,
        onPlayAgain: () => {
             // Se for local, recomeça. Se for online, vai para o menu (nova busca)
             if (isOnline) navigateTo('menu');
             else navigateTo('game');
        },
        onGoToMenu: () => navigateTo('menu')
      });
    }, 800);
  }

  // --- INICIALIZAÇÃO ---
  if (isOnline) {
    unsubscribeSSE = network.subscribe(
      state.session.gameId,
      state.session.nick,
      onServerUpdate,
      (err) => { toast(err, 'error'); }
    );
  } else {
    updateHUDLocal();
  }

  container.appendChild(root);
  window.cleanupGameView = () => {
    document.removeEventListener('keydown', handleKeyPress);
    document.removeEventListener('click', handleClickOutside, true);
    
    // 🔥 Fecha SSE
    if (unsubscribeSSE) unsubscribeSSE();
    
    // 🔥 Remove popovers
    if (audioPopover) audioPopover.remove();
    document.querySelectorAll('.shortcuts-popover').forEach(p => p.remove());
    
    // 🔥 Limpa toasts
    document.querySelectorAll('.toast').forEach(t => {
      if (t.dataset.timeoutId) clearTimeout(parseInt(t.dataset.timeoutId));
      t.remove();
    });
    
    // 🔥 Remove cursor de loading
    root.classList.remove('waiting-server');
  };
}