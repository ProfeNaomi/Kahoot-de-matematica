// common.js - Utilidades generales y Sintetizador de Sonido Avanzado (Web Audio API)

// Sintetizador de efectos sonoros por código y música de fondo (sin archivos mp3 externos)
class SoundFX {
  constructor() {
    this.audioCtx = null;
    this.enabled = true;
    this.lobbyInterval = null;
    this.thinkingInterval = null;
    this.init();
  }

  init() {
    // Inicializar el contexto de audio con la primera interacción del usuario
    const startAudio = () => {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    };

    window.addEventListener('click', startAudio, { once: true });
    window.addEventListener('touchstart', startAudio, { once: true });
    window.addEventListener('keydown', startAudio, { once: true });
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) {
      this.stopLobbyMusic();
      this.stopThinkingMusic();
    }
    return this.enabled;
  }

  playTone(freq, type = 'sine', duration = 0.2, gainVal = 0.1) {
    if (!this.enabled || !this.audioCtx) return;

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(gainVal, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {
      console.warn('Audio error:', e);
    }
  }

  // Sonido de tic-tac de temporizador normal
  playTick() {
    this.playTone(800, 'sine', 0.08, 0.06);
  }

  // Alerta de urgencia (últimos 3 segundos)
  playCountdownAlert(secondsLeft) {
    if (!this.enabled || !this.audioCtx) return;
    const freqs = { 3: 880, 2: 987.77, 1: 1108.73 };
    const freq = freqs[secondsLeft] || 1000;
    this.playTone(freq, 'triangle', 0.25, 0.15);
  }

  // Sonido de inicio de pregunta (Acorde ascendente épico)
  playStart() {
    this.stopLobbyMusic();
    this.stopThinkingMusic();
    this.playTone(440, 'triangle', 0.15, 0.12);
    setTimeout(() => this.playTone(554.37, 'triangle', 0.15, 0.12), 120);
    setTimeout(() => this.playTone(659.25, 'triangle', 0.35, 0.18), 240);
    setTimeout(() => this.playTone(880.00, 'triangle', 0.5, 0.2), 360);
  }

  // Sonido de respuesta correcta (Acorde feliz triunfal)
  playCorrect() {
    this.stopThinkingMusic();
    this.playTone(523.25, 'sine', 0.15, 0.15); // C5
    setTimeout(() => this.playTone(659.25, 'sine', 0.15, 0.15), 100); // E5
    setTimeout(() => this.playTone(783.99, 'sine', 0.15, 0.15), 200); // G5
    setTimeout(() => this.playTone(1046.50, 'sine', 0.5, 0.25), 300); // C6
  }

  // Sonido de respuesta incorrecta (Buzzer bajo y grave)
  playWrong() {
    this.stopThinkingMusic();
    this.playTone(150, 'sawtooth', 0.25, 0.18);
    setTimeout(() => this.playTone(120, 'sawtooth', 0.45, 0.18), 180);
  }

  // Fanfarria de victoria en podio
  playFanfare() {
    this.stopLobbyMusic();
    this.stopThinkingMusic();
    const notes = [523.25, 523.25, 523.25, 659.25, 783.99, 659.25, 783.99, 1046.50, 1318.51];
    const times = [0, 140, 280, 420, 560, 750, 900, 1050, 1250];
    const durations = [0.12, 0.12, 0.12, 0.12, 0.18, 0.12, 0.12, 0.2, 0.8];

    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'triangle', durations[idx], 0.22);
      }, times[idx]);
    });
  }

  // --- MÚSICA DE FONDO SINTETIZADA ---

  // Música del Lobby (Melodía alegre y rítmica al estilo Kahoot)
  playLobbyMusic() {
    if (!this.enabled) return;
    this.stopLobbyMusic();
    this.stopThinkingMusic();

    const melody = [
      { f: 523.25, d: 0.15, t: 0 },    // C5
      { f: 659.25, d: 0.15, t: 250 },  // E5
      { f: 783.99, d: 0.15, t: 500 },  // G5
      { f: 880.00, d: 0.25, t: 750 },  // A5
      { f: 783.99, d: 0.25, t: 1100 }, // G5
      { f: 659.25, d: 0.25, t: 1450 }  // E5
    ];

    const playLoop = () => {
      if (!this.enabled || !this.audioCtx) return;
      melody.forEach(note => {
        setTimeout(() => {
          if (this.lobbyInterval) {
            this.playTone(note.f, 'sine', note.d, 0.04);
          }
        }, note.t);
      });
    };

    playLoop();
    this.lobbyInterval = setInterval(playLoop, 2000);
  }

  stopLobbyMusic() {
    if (this.lobbyInterval) {
      clearInterval(this.lobbyInterval);
      this.lobbyInterval = null;
    }
  }

  // Música de Suspenso durante la pregunta (Thinking Pulse)
  playThinkingMusic() {
    if (!this.enabled) return;
    this.stopLobbyMusic();
    this.stopThinkingMusic();

    const pulseNotes = [220.00, 246.94, 261.63, 293.66]; // A3, B3, C4, D4
    let step = 0;

    const playPulse = () => {
      if (!this.enabled || !this.audioCtx) return;
      const freq = pulseNotes[step % pulseNotes.length];
      this.playTone(freq, 'triangle', 0.2, 0.05);
      step++;
    };

    this.thinkingInterval = setInterval(playPulse, 600);
  }

  stopThinkingMusic() {
    if (this.thinkingInterval) {
      clearInterval(this.thinkingInterval);
      this.thinkingInterval = null;
    }
  }
}

// Instancia global de sonido
const soundFX = new SoundFX();

// Control de botón de sonido en el header
document.addEventListener('DOMContentLoaded', () => {
  const soundBtn = document.getElementById('soundToggle');
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      const isOn = soundFX.toggle();
      soundBtn.innerHTML = isOn ? '🔊' : '🔇';
      soundBtn.title = isOn ? 'Sonido Activado' : 'Sonido Silenciado';
      if (isOn) soundFX.playTick();
    });
  }
});

// Función para disparar confeti (sin librerías pesadas)
function triggerConfetti(container = document.body, count = 50) {
  const colors = ['#e21b3c', '#1368ce', '#d89e00', '#26890c', '#7000ff', '#ffd700'];
  
  for (let i = 0; i < count; i++) {
    const confetti = document.createElement('div');
    confetti.style.position = 'fixed';
    confetti.style.width = `${Math.random() * 12 + 6}px`;
    confetti.style.height = `${Math.random() * 12 + 6}px`;
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.left = `${Math.random() * 100}vw`;
    confetti.style.top = '-20px';
    confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    confetti.style.zIndex = '9999';
    confetti.style.pointerEvents = 'none';
    confetti.style.opacity = '0.9';
    
    container.appendChild(confetti);
    
    const duration = Math.random() * 2 + 2;
    const delay = Math.random() * 0.5;
    const horizontalMove = (Math.random() - 0.5) * 300;
    
    confetti.animate([
      { transform: 'translate3d(0, 0, 0) rotate(0deg)', opacity: 1 },
      { transform: `translate3d(${horizontalMove}px, 105vh, 0) rotate(${Math.random() * 720}deg)`, opacity: 0 }
    ], {
      duration: duration * 1000,
      delay: delay * 1000,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
    }).onfinish = () => confetti.remove();
  }
}
