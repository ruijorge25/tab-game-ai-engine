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
import { createOnlineEngine } from '../game/engine.online.js'; 
import { getBestMoveWithHint, findBestMove } from '../game/ai.js';

export function renderGameView(container) {
  let engine;
  let isOnline = false;
  let unsubscribeSSE = null;

  //  Inicializa flag
  window.autoPassInProgress = false;

  // 1. DECISÃO DE MOTOR
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
  
  const username = isOnline ? state.session.nick : (localStorage.getItem('tab_username') || 'Utilizador');

  const root = document.createElement('div');
  root.className = 'game-scene';

  // 2. HTML 
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
        
        <button class="btn-icon" id="btn-hints" title="Dicas">
          <svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18h6"></path>
            <path d="M10 22h4"></path>
            <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1.33.47 2.48 1.5 3.5.76.76 1.23 1.52 1.41 2.5"></path>
          </svg>
        </button>

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


  let diceBtn; 
  let humanMoves = 0;
  let humanCaptures = 0;
  let aiMoves = 0;
  let aiCaptures = 0;

  // 3. RECUPERAR POPOVER DE ÁUDIO (Mantido igual)
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

  // 4. LÓGICA DE JOGO
  let isProcessingMove = false;

  async function handleInteraction(r, c) {
    if (isProcessingMove) {
      console.log('[GameView] Movimento em processamento, aguarde...');
      return;
    }
    
    if (isOnline) {
      const currentTurn = engine.getCurrentPlayer();
      if (currentTurn !== 1) {
        console.log('[GameView] Não é a minha vez');
        return;
      }
      
      isProcessingMove = true;
      root.classList.add('waiting-server');
      
      try {
        await engine.interaction(r, c);
      } catch (err) {
        console.error('[GameView] Erro:', err);
        toast(err.message, 'error');
      } finally {
        isProcessingMove = false;
        root.classList.remove('waiting-server');
      }
    } else {
      localInteractionMove(r, c);
    }
  }

  const board = Board({
    engine,
    onSelect: (r, c) => handleInteraction(r, c),
    onMove: (r, c) => handleInteraction(r, c)
  });
  boardPane.appendChild(board.el);

  const dice = Dice(async () => {
    try {
      if (isOnline) {
        const serverState = engine.getState?.();
        const players = serverState?.players;
        if (!players || Object.keys(players).length < 2) {
          toast('À espera de adversário...', 'info');
          return;
        }
        
        const diceObj = (typeof engine.getDiceObj === 'function') ? engine.getDiceObj() : null;
        const keepPlaying = diceObj?.keepPlaying;
        const hasDice = !!diceObj;
        
        // Verifica movimentos
        let hasMoves = true;
        if (typeof engine.hasAnyValidMove === 'function') {
          hasMoves = engine.hasAnyValidMove();
        }

        // Se temos dado extra (1, 4, 6) MAS não temos movimentos:
        if (hasDice && keepPlaying && !hasMoves) {
            console.log('[GameView] Preso com jogada extra. A forçar novo lançamento (rollDice) em vez de passar.');

            await engine.rollDice();
            return null;
        }

        // Caso normal: Rolar
        await engine.rollDice();
        return null; 
      } else {
        // ... lógica local ...
        const val = engine.rollDice();
        updateHUDLocal();
        localCheckAutoPass(1);
        return val;
      }
    } catch (err) {
      toast(err.message, 'error');
      // Em caso de erro, atualiza visualmente para garantir que não fica bloqueado
      return engine.getDice();
    }
  });

  // Listener no holder do dado
  diceHolder.addEventListener('click', () => {
    if (root.classList.contains('waiting-server')) return;
    if (!diceBtn) return;
    
    if (diceBtn.classList.contains('is-disabled')) {
      const isMyTurn = engine.getCurrentPlayer() === 1;
      const hasDice = engine.getDice() != null;
      
      let hasMoves = true;
      if (typeof engine.hasAnyValidMove === 'function') {
        hasMoves = engine.hasAnyValidMove(); // Online 
      } else if (typeof engine.canPass === 'function') {
        hasMoves = !engine.canPass(); // Local
      }

      if (!isMyTurn) {
        toast(isOnline ? 'Não é a sua vez.' : 'Aguarde, é a vez do computador.', 'info');
      } 
      else if (hasDice) {
        // Se realmente não há movimentos, o auto-pass trata disso
        if (hasMoves) {
          toast('Tens jogadas disponíveis. Mova a peça antes de lançar de novo.', 'warning');
        } else {
          toast('A processar passagem de turno...', 'info');
        }
      }
    }
  });

  diceHolder.appendChild(dice);
  diceBtn = dice.querySelector('button');
  dice.dataset.lastValue = ''; 

  // 5. UPDATE ONLINE (SSE)
  function onServerUpdate(data) {
    engine.update(data);
    
    board.render();
    root.classList.remove('waiting-server');
    isProcessingMove = false; // Liberta o bloqueio
    
    const diceObj = engine.getDiceObj();
    const newDiceValue = diceObj ? diceObj.value : null;
    const prevDiceValue = dice.dataset.lastValue ? parseInt(dice.dataset.lastValue) : null;
    const diceWasRolled = (prevDiceValue === null && newDiceValue !== null);
    
    setDiceValue(dice, newDiceValue);
    
    if (diceWasRolled && state.config.animations !== false) {
      const sticks = dice.querySelector('.dice-sticks');
      sticks.classList.add('dice-bounce');
      setTimeout(() => sticks.classList.remove('dice-bounce'), 600);
      if (newDiceValue === 6 || newDiceValue === 4 || newDiceValue === 1) {
        createGoldenParticlesExported(dice);
      }
    }
    
    dice.dataset.lastValue = newDiceValue ?? '';

    // HIGHLIGHTS baseados no step do servidor (só se for minha vez)
    const isMyTurn = (data.turn === state.session.nick);
    if (isMyTurn && data.step === 'to' && data.selected && data.selected.length > 0) {
      // Servidor enviou destinos possíveis
      const highlights = engine.getHighlights();
      if (highlights.length > 0) {
        const firstPiece = highlights[0]; // A peça selecionada é o primeiro elemento
        const validMoves = highlights.slice(1); // Os destinos são o resto
        board.highlightSelection(firstPiece.row, firstPiece.col, validMoves);
      }
    } else {
      // Limpa highlights
      board.clearHighlights();
    }

    updateHUDOnline(data);
    updateCaptureCounters();

    // Verificação de vitória
    if (data.winner) {
      const isMe = (data.winner === state.session.nick);
      
      // Salva resultado online no WebStorage
      const opponent = Object.keys(data.players || {}).find(nick => nick !== state.session.nick) 
                      || root.querySelector('#player-opponent .player-label')?.textContent 
                      || 'Adversário';
      
      // Import dinâmico para evitar dependências circulares
      import('../ui/Modal.js').then(mod => {
        mod.saveOnlineResult({ won: isMe, opponent });
      });
      
      triggerEndGame(isMe ? 1 : 2, data.winner);
      return;
    }


    const pieceCounts = engine.getPieceCounts ? engine.getPieceCounts() : null;
    if (pieceCounts) {
      console.log('[GameView] Contagem de peças:', pieceCounts);
      
      if (pieceCounts.player1 === 0) {
        // Eu perdi (todas as minhas peças foram comidas)
        const opponentNick = Object.keys(data.players || {}).find(nick => nick !== state.session.nick) || 'Adversário';
        triggerEndGame(2, opponentNick);
        return;
      }
      
      if (pieceCounts.player2 === 0) {
        // Eu ganhei (todas as peças do adversário foram comidas)
        triggerEndGame(1, state.session.nick);
        return;
      }
    }
  }

  function updateHUDOnline(data) {
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

    const diceValue = data.dice?.value;
    const keepPlaying = data.dice?.keepPlaying;

    let hasMoves = true;
    if (isMyTurn && data.dice && typeof engine.hasAnyValidMove === 'function') {
      hasMoves = !!engine.hasAnyValidMove();
    }

    // Botão de Dado
    // Permite rolar se:
    // A) É minha vez e não tenho dado (rolar normal)
    // B) É minha vez, tenho dado extra (keepPlaying), mas NÃO tenho movimentos
    const canRoll = (isMyTurn && !data.dice) || (isMyTurn && keepPlaying && !hasMoves);
    
    if (diceBtn) {
      const disabled = !canRoll;
      diceBtn.classList.toggle('is-disabled', disabled);
      diceBtn.style.pointerEvents = disabled ? 'none' : 'auto';
      diceBtn.style.opacity = disabled ? '0.6' : '1';
      if (!disabled) diceBtn.classList.add('dice-ready');
      else diceBtn.classList.remove('dice-ready');
    }

    // Auto-Pass: Apenas se servidor mandar mustPass
    if (data.mustPass && data.mustPass === state.session.nick && !window.autoPassInProgress) {
      window.autoPassInProgress = true;
      toast('Sem jogadas disponíveis. A passar a vez...', 'info');
      if (diceBtn) diceBtn.classList.add('is-disabled');
      
      setTimeout(() => {
        engine.passTurn()
          .catch(err => console.error('[GameView] Erro ao passar vez:', err))
          .finally(() => {
            window.autoPassInProgress = false;
          });
      }, 1500);
    }
    
    updateSoundIcon();
  }

  function updateCaptureCounters() {
    if (!isOnline) return;
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
    
    console.log('[GameView] Peças restantes:', { 
      minhas: player1Pieces, 
      adversario: player2Pieces
    });
    
    root.querySelector('#counter-human').textContent = player1Pieces; // Minhas peças restantes
    root.querySelector('#counter-ai').textContent = player2Pieces; // Peças do adversário restantes
  }

  // 6. UPDATE LOCAL
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
      toast(`Computador tirou ${diceVal}!`, 'info');
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
      
      const msg = player === 1 
        ? 'Sem jogadas disponiveis. A passar...' 
        : 'Computador sem jogadas. A passar...';
      
      toast(msg, 'info');
      
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

  function updateSoundIcon() {
    const btnSound = root.querySelector('#btn-toggle-sound');
    if (btnSound) {
      const isMuted = !state.config.audio.musicOn && !state.config.audio.sfxOn;
      btnSound.classList.toggle('is-muted', isMuted);
    }
  }

  // 7. LISTENERS 
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
               triggerEndGame(2, 'Computador'); 
            }
            state.session.gameId = null;
            navigateTo('menu'); 
          }
        },
        { text: 'Cancelar', className: 'btn btn-secondary' }
      ]
    });
  };

  root.querySelector('#btn-rules').onclick = () => showRulesModal();

  root.querySelector('#btn-hints').onclick = () => {
    // No modo online, verifica se é o turno do jogador
    if (isOnline) {
      const currentTurn = engine.getState?.()?.turn;
      const myNick = state.session?.nick;
      if (currentTurn !== myNick) {
        toast('Não é a sua vez.', 'warning');
        return;
      }
    } else {
      if (engine.getCurrentPlayer() !== 1) {
        toast('Não é a sua vez.', 'warning');
        return;
      }
    }
    
    // Verifica se o dado foi lançado
    const diceValue = isOnline ? engine.getState?.()?.dice?.value : engine.getDice();
    if (diceValue == null) {
      toast('Lance o dado primeiro.', 'warning');
      return;
    }
    
    board.clearHighlights();
    
    // No modo online, usa o localValidator para calcular a dica
    const validatorEngine = isOnline ? engine.getLocalValidator?.() : engine;
    if (!validatorEngine) {
      toast('Sistema de dicas indisponível.', 'error');
      return;
    }
    
    const hint = getBestMoveWithHint(validatorEngine);
    if (!hint || !hint.move) {
      toast('Sem jogadas.', 'info');
      return;
    }
    
    const { move, reason } = hint;
    
    // No modo online, transforma coordenadas lógicas para visuais
    let pieceRow = move.piece.row;
    let pieceCol = move.piece.col;
    let targetPos = move.target;
    
    if (isOnline) {
      // Transforma posição da peça
      const visualPiece = engine.transformCoords(pieceRow, pieceCol);
      pieceRow = visualPiece.row;
      pieceCol = visualPiece.col;
      
      // Transforma posição do alvo
      const visualTarget = engine.transformCoords(targetPos.row, targetPos.col);
      targetPos = { row: visualTarget.row, col: visualTarget.col };
    }
    
    const validMoves = validatorEngine.getValidMoves(move.piece.row, move.piece.col);
    board.highlightSelection(pieceRow, pieceCol, [targetPos]);
    toast(`Dica: ${reason}`, 'success');
  };
  
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
    if (key === 'h') root.querySelector('#btn-hints').click();
    if (key === 'r') showRulesModal();
  };
  document.addEventListener('keydown', handleKeyPress);

  // 8. FIM DE JOGO E TRANSIÇÕES
  function triggerEndGame(winnerCode, winnerName) {
    const isWin = (winnerCode === 1);
    
    // Toca o som
    playSound(isWin ? 'victory' : 'defeat');
    
    // Estatísticas
    const stats = { won: isWin, captures: humanCaptures, moves: humanMoves };
    
    // Se for local, guarda logo o resultado
    if (!isOnline) saveGameResult(stats);


    if (isOnline) {
      state.session.gameId = null;
      navigateTo('menu');
    }

    // Pequeno delay para a transição
    setTimeout(() => {
      showVictoryModal({ 
        winner: isOnline ? winnerName : winnerCode, 
        stats: isOnline ? {} : stats,
        
        // --- JOGAR NOVAMENTE ---
        onPlayAgain: async () => {
             closeModal();

             if (isOnline) {
               // MODO ONLINE
               if (unsubscribeSSE) {
                 unsubscribeSSE = null; // A conexão já foi fechada ao sair da view, limpamos a ref
               }

               document.body.classList.add('waiting-server'); 
               toast('A procurar novo adversário...', 'info');

               try {
                 const newGameData = await network.join(
                    state.session.group || 34, 
                    state.session.nick, 
                    state.session.password, 
                    state.config.columns || 9
                 );

                 if (newGameData.game) {
                   state.session.gameId = newGameData.game;
                   navigateTo('game'); // Volta para o jogo
                 } else {
                   throw new Error('ID de jogo inválido');
                 }
               } catch (err) {
                 console.error(err);
                 toast('Erro ao encontrar jogo: ' + err.message, 'error');
               } finally {
                 document.body.classList.remove('waiting-server');
               }

             } else {
               // MODO LOCAL
               navigateTo('game');
             }
        },

        onGoToMenu: () => {
            closeModal(); 
            // Se for local, navega agora. 
            // Se for online, já estamos no menu, mas o navigate garante consistência.
            if (!isOnline) {
                state.session.gameId = null;
                if (unsubscribeSSE) { unsubscribeSSE(); unsubscribeSSE = null; }
                navigateTo('menu');
            }
        }
      });
    }, 800);
  }

  // --- INICIALIZAÇÃO ---
  if (isOnline) {
    unsubscribeSSE = network.subscribe(
      state.session.gameId,
      state.session.nick,
      onServerUpdate,
      (err) => { 
          toast(err, 'error');
          // Redirecionar para menu após erro crítico
          setTimeout(() => {
              state.session.gameId = null;
              navigateTo('menu');
          }, 3000);
      }
    );
  } else {
    updateHUDLocal();
  }

  container.appendChild(root);
  window.cleanupGameView = () => {
    document.removeEventListener('keydown', handleKeyPress);
    document.removeEventListener('click', handleClickOutside, true);
    if (unsubscribeSSE) unsubscribeSSE();
    if (audioPopover) audioPopover.remove();
    document.querySelectorAll('.shortcuts-popover').forEach(p => p.remove());
    document.querySelectorAll('.toast').forEach(t => {
      if (t.dataset.timeoutId) clearTimeout(parseInt(t.dataset.timeoutId));
      t.remove();
    });
    root.classList.remove('waiting-server');
  };
}