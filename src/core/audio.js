import { state } from './state.js';

// Define as músicas para cada tema
const themeMusicMap = {
  'christmas': 'src/assets/sounds/Christmas_song.mp3',
  'halloween': 'src/assets/sounds/Halloween_song.mp3',
  'default': 'src/assets/sounds/music_bg.mp3'
};

// A música agora é 'let' e começa com o default
let music = new Audio(themeMusicMap['default']);
music.loop = true;

const sfx = {
  flip: new Audio('src/assets/sounds/flip.mp3'),//SOM DE ATIRAR OS PAUS
  victory: new Audio('src/assets/sounds/victory.mp3'),//SOM DE VITORIA
  defeat: new Audio('src/assets/sounds/defeat.mp3'), // SOM DE DERROTA
  goodcapture: new Audio('src/assets/sounds/goodcapture.mp3'),//SOM DE CAPTURA
  badcapture: new Audio('src/assets/sounds/badcapture.mp3')//SOM DE SER CAPTURADO
};

// Toca um EFEITO SONORO (SFX)
export function playSound(name) {
  // 1. Verifica se os SFX estão ligados
  if (!state.config.audio.sfxOn) return;

  const sound = sfx[name];
  if (!sound) {
    console.warn(`Som SFX não encontrado: ${name}`); // Aviso se o som não existir
    return;
  }
  
  sound.volume = 0.5; // Volume fixo para SFX
  
  if (!sound.paused) {
    sound.currentTime = 0;
  }
  
  sound.play().catch(e => {});
}

// Define a música de fundo com base no tema
export function setThemeMusic(theme) {
  const newSrc = themeMusicMap[theme] || themeMusicMap['default'];
  
  // Verifica se o URL completo termina com o novo caminho 
  if (music.src && music.src.endsWith(newSrc)) {
    return; // Já está a tocar a música certa
  }

  console.log(`Áudio: A trocar música para ${newSrc}`);
  
  // Guarda o estado atual (se estava a tocar e o volume)
  const wasPlaying = state.config.audio.musicOn;
  const currentVolume = state.config.audio.musicVolume;

  music.pause();
  music.src = newSrc; // Troca a fonte
  music.load();
  music.volume = currentVolume; // Reaplica o volume
  
  // Se a música estava ligada, começa a tocar a nova
  if (wasPlaying) {
    music.play().catch(e => {});
  }
}

/**
 * Atualiza o estado da MÚSICA (volume e play/pause)
 * Esta função deve ser chamada sempre que algo no 'state.config.audio' muda
 */
export function updateMusicStatus() {
  const { musicOn, musicVolume } = state.config.audio;

  if (musicOn) {
    music.volume = musicVolume;
    music.play().catch(e => {
      // Ignora erro de "interação"
    });
  } else {
    music.pause();
  }
}

/* Altera o volume da música (chamado pelo slider)*/
export function setMusicVolume(volume) {
  state.config.audio.musicVolume = parseFloat(volume);
  // Se a música estiver desligada, isto apenas guarda o volume
  // Se estiver ligada, atualiza imediatamente
  if (state.config.audio.musicOn) {
    music.volume = state.config.audio.musicVolume;
  }
}

/*Liga/desliga a MÚSICA*/
export function toggleMusic() {
  state.config.audio.musicOn = !state.config.audio.musicOn;
  updateMusicStatus();
}

/*Liga/desliga os EFEITOS SONOROS*/
export function toggleSFX() {
  state.config.audio.sfxOn = !state.config.audio.sfxOn;
}