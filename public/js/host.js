// host.js - Lógica del Proyector (Profesor) usando Socket.io y Sonido Avanzado

const socket = io();

// Variables de estado
let currentPin = null;
let currentQuiz = null;
let totalPlayers = 0;
let timerInterval = null;
let currentQuestionTime = 15;

// Elementos del DOM
const selectScreen = document.getElementById('selectScreen');
const lobbyScreen = document.getElementById('lobbyScreen');
const questionScreen = document.getElementById('questionScreen');
const resultsScreen = document.getElementById('resultsScreen');
const podiumScreen = document.getElementById('podiumScreen');

const quizList = document.getElementById('quizList');
const qrImage = document.getElementById('qrImage');
const joinUrlText = document.getElementById('joinUrlText');
const mainPin = document.getElementById('mainPin');
const headerPin = document.getElementById('headerPin');
const pinBadge = document.getElementById('pinBadge');
const playerCount = document.getElementById('playerCount');
const playersGrid = document.getElementById('playersGrid');
const btnStartGame = document.getElementById('btnStartGame');

// Elementos de la pantalla de pregunta
const questionCounter = document.getElementById('questionCounter');
const timeLeftEl = document.getElementById('timeLeft');
const timerBar = document.getElementById('timerBar');
const answeredCountEl = document.getElementById('answeredCount');
const totalPlayersCountEl = document.getElementById('totalPlayersCount');
const questionText = document.getElementById('questionText');
const opt0Text = document.getElementById('opt0Text');
const opt1Text = document.getElementById('opt1Text');
const opt2Text = document.getElementById('opt2Text');
const opt3Text = document.getElementById('opt3Text');
const btnSkipTimer = document.getElementById('btnSkipTimer');

// Elementos de resultados
const correctAnswerText = document.getElementById('correctAnswerText');
const bar0 = document.getElementById('bar0');
const bar1 = document.getElementById('bar1');
const bar2 = document.getElementById('bar2');
const bar3 = document.getElementById('bar3');
const top5List = document.getElementById('top5List');
const btnNextQuestion = document.getElementById('btnNextQuestion');

// 1. Cargar lista de cuestionarios al iniciar
document.addEventListener('DOMContentLoaded', () => {
  fetch('/api/quizzes')
    .then(res => res.json())
    .then(quizzes => {
      renderQuizSelection(quizzes);
    })
    .catch(err => {
      quizList.innerHTML = `<p style="color: #ff4d6d; grid-column: 1/-1;">Error al cargar cuestionarios. ¿Está ejecutándose el servidor Node.js?</p>`;
    });
});

function renderQuizSelection(quizzes) {
  if (quizzes.length === 0) {
    quizList.innerHTML = `<p style="color: var(--text-muted); grid-column: 1/-1;">No hay cuestionarios guardados. <a href="creator.html" style="color: var(--color-blue);">Crea uno aquí</a>.</p>`;
    return;
  }

  quizList.innerHTML = quizzes.map(q => `
    <div class="glass-panel glass-panel-hover quiz-card" onclick="selectQuiz('${q.id}')">
      <div>
        <span style="background: rgba(255,255,255,0.1); padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 700;">
          📂 ${q.category || 'General'}
        </span>
        <h3 style="font-size: 1.6rem; margin: 12px 0 8px;">${q.title}</h3>
        <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 20px;">${q.description || ''}</p>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 12px; font-weight: 700;">
        <span>❓ ${q.questions.length} Preguntas</span>
        <span style="color: var(--color-purple);">ELEGIR PARA JUGAR →</span>
      </div>
    </div>
  `).join('');
}

// 2. Profesor selecciona un juego para crear la sala
function selectQuiz(quizId) {
  socket.emit('create-game', { quizId });
}

// Evento: Sala creada por el servidor
socket.on('game-created', ({ pin, quizTitle, joinUrl, qrImage: qrBase64 }) => {
  currentPin = pin;
  
  // Cambiar de pantalla
  selectScreen.classList.add('hidden');
  lobbyScreen.classList.remove('hidden');
  pinBadge.classList.remove('hidden');
  
  mainPin.textContent = pin;
  headerPin.textContent = pin;
  joinUrlText.textContent = joinUrl;
  
  if (qrBase64) {
    qrImage.src = qrBase64;
  } else {
    qrImage.alt = "QR no disponible";
  }

  // Activar música de fondo del Lobby al estilo Kahoot
  soundFX.playStart();
  setTimeout(() => {
    soundFX.playLobbyMusic();
  }, 600);
});

// Evento: Alumno se une a la sala
socket.on('player-joined', ({ id, nickname, avatar, totalPlayers: total }) => {
  totalPlayers = total;
  playerCount.textContent = totalPlayers;
  
  const chip = document.createElement('div');
  chip.className = 'player-chip';
  chip.id = `player-${id}`;
  chip.innerHTML = `<span>${avatar || '👾'}</span> <span>${nickname}</span>`;
  playersGrid.appendChild(chip);

  btnStartGame.disabled = (totalPlayers === 0);
  soundFX.playTone(600, 'sine', 0.1, 0.08); // Pequeño pop sonoro
});

// Evento: Alumno sale o se desconecta
socket.on('player-left', ({ id, totalPlayers: total }) => {
  totalPlayers = total;
  playerCount.textContent = totalPlayers;
  const chip = document.getElementById(`player-${id}`);
  if (chip) chip.remove();
  btnStartGame.disabled = (totalPlayers === 0);
});

// 3. Iniciar el juego
btnStartGame.addEventListener('click', () => {
  if (totalPlayers > 0) {
    soundFX.stopLobbyMusic();
    socket.emit('start-game', { pin: currentPin });
  }
});

// Evento: Empieza una pregunta
socket.on('question-start', ({ questionIndex, totalQuestions, questionText: text, options, timeLimit }) => {
  soundFX.stopLobbyMusic();
  soundFX.stopThinkingMusic();

  lobbyScreen.classList.add('hidden');
  resultsScreen.classList.add('hidden');
  questionScreen.classList.remove('hidden');

  questionCounter.textContent = `Pregunta ${questionIndex + 1} de ${totalQuestions}`;
  questionText.textContent = text;
  opt0Text.textContent = options[0] || '';
  opt1Text.textContent = options[1] || '';
  opt2Text.textContent = options[2] || '';
  opt3Text.textContent = options[3] || '';

  answeredCountEl.textContent = '0';
  totalPlayersCountEl.textContent = totalPlayers;

  currentQuestionTime = timeLimit || 15;
  startTimer(currentQuestionTime);
  
  // Acorde épico inicial y luego música de suspenso (Thinking music)
  soundFX.playStart();
  setTimeout(() => {
    soundFX.playThinkingMusic();
  }, 500);
});

// Temporizador visual
function startTimer(seconds) {
  clearInterval(timerInterval);
  let remaining = seconds;
  timeLeftEl.textContent = remaining;
  timerBar.style.width = '100%';
  timerBar.style.transition = 'width 1s linear';

  timerInterval = setInterval(() => {
    remaining--;
    timeLeftEl.textContent = remaining;
    
    const pct = (remaining / seconds) * 100;
    timerBar.style.width = `${pct}%`;

    // Alertas sonoras crecientes en los últimos 3 segundos
    if (remaining <= 3 && remaining > 0) {
      soundFX.playCountdownAlert(remaining);
    } else if (remaining <= 5 && remaining > 3) {
      soundFX.playTick();
    }

    if (remaining <= 0) {
      clearInterval(timerInterval);
      soundFX.stopThinkingMusic();
      socket.emit('show-results', { pin: currentPin });
    }
  }, 1000);
}

// Cortar tiempo manualmente
btnSkipTimer.addEventListener('click', () => {
  clearInterval(timerInterval);
  soundFX.stopThinkingMusic();
  socket.emit('show-results', { pin: currentPin });
});

// Evento: Alguien respondió
socket.on('answer-received', ({ answeredCount, totalPlayers: total }) => {
  answeredCountEl.textContent = answeredCount;
  totalPlayersCountEl.textContent = total;
});

// Evento: Todos respondieron
socket.on('all-answered', () => {
  clearInterval(timerInterval);
  soundFX.stopThinkingMusic();
  setTimeout(() => {
    socket.emit('show-results', { pin: currentPin });
  }, 800);
});

// Evento: Resultados de la pregunta
socket.on('question-results', ({ correctOption, distribution, leaderboard }) => {
  clearInterval(timerInterval);
  soundFX.stopThinkingMusic();
  
  questionScreen.classList.add('hidden');
  resultsScreen.classList.remove('hidden');

  const shapes = ['▲ Rojo', '◆ Azul', '● Amarillo', '■ Verde'];
  correctAnswerText.textContent = `✓ La respuesta correcta era: ${shapes[correctOption]}`;

  // Calcular porcentaje para altura de barras
  const maxCount = Math.max(...distribution, 1);
  const bars = [bar0, bar1, bar2, bar3];
  
  distribution.forEach((count, idx) => {
    bars[idx].textContent = count;
    const heightPct = Math.max((count / maxCount) * 100, 10);
    bars[idx].style.height = `${heightPct}%`;
    
    // Resaltar barra correcta y opacar las incorrectas
    if (idx === correctOption) {
      bars[idx].style.opacity = '1';
      bars[idx].style.boxShadow = '0 0 20px rgba(255, 255, 255, 0.6)';
    } else {
      bars[idx].style.opacity = '0.35';
      bars[idx].style.boxShadow = 'none';
    }
  });

  // Renderizar Top 5 parcial
  top5List.innerHTML = leaderboard.map((p, idx) => `
    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); padding: 10px 16px; border-radius: 8px;">
      <div style="display: flex; gap: 12px; align-items: center;">
        <span style="font-weight: 800; color: var(--color-gold);">${idx + 1}º</span>
        <span>${p.avatar || '👾'} <strong>${p.nickname}</strong></span>
      </div>
      <span style="font-weight: 800; color: #a5b4fc;">${p.score} pts</span>
    </div>
  `).join('');

  soundFX.playCorrect();
});

// 4. Siguiente pregunta
btnNextQuestion.addEventListener('click', () => {
  socket.emit('next-question', { pin: currentPin });
});

// Evento: Fin del juego y Podio
socket.on('game-over', ({ podium, standings }) => {
  soundFX.stopThinkingMusic();
  soundFX.stopLobbyMusic();
  
  resultsScreen.classList.add('hidden');
  podiumScreen.classList.remove('hidden');

  triggerConfetti(document.body, 100);
  soundFX.playFanfare();

  // Renderizar Podio (2do, 1ero, 3ero)
  if (podium[1]) {
    document.getElementById('place2').classList.remove('hidden');
    document.getElementById('avatar2').textContent = podium[1].avatar || '🥈';
    document.getElementById('name2').textContent = podium[1].nickname;
    document.getElementById('score2').textContent = `${podium[1].score} pts`;
  }
  if (podium[0]) {
    document.getElementById('place1').classList.remove('hidden');
    document.getElementById('avatar1').textContent = podium[0].avatar || '👑';
    document.getElementById('name1').textContent = podium[0].nickname;
    document.getElementById('score1').textContent = `${podium[0].score} pts`;
  }
  if (podium[2]) {
    document.getElementById('place3').classList.remove('hidden');
    document.getElementById('avatar3').textContent = podium[2].avatar || '🥉';
    document.getElementById('name3').textContent = podium[2].nickname;
    document.getElementById('score3').textContent = `${podium[2].score} pts`;
  }

  // Renderizar tabla general
  const fullStandings = document.getElementById('fullStandings');
  fullStandings.innerHTML = standings.map((p, idx) => `
    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); padding: 12px 20px; border-radius: 8px;">
      <div style="display: flex; gap: 16px; align-items: center;">
        <span style="font-weight: 800; width: 30px; color: var(--text-muted);">${idx + 1}º</span>
        <span style="font-size: 1.3rem;">${p.avatar || '👾'}</span>
        <strong style="font-size: 1.1rem;">${p.nickname}</strong>
      </div>
      <div style="display: flex; gap: 20px; align-items: center;">
        <span style="font-size: 0.9rem; color: var(--color-green);">🔥 Racha máx: ${p.streak || 0}</span>
        <span style="font-weight: 800; font-size: 1.2rem; color: var(--color-gold);">${p.score} pts</span>
      </div>
    </div>
  `).join('');

  // Guardar standings para exportación
  window.lastStandings = standings;
});

// Exportar notas/estadísticas en JSON
document.getElementById('btnExportStats').addEventListener('click', () => {
  if (!window.lastStandings) return;
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(window.lastStandings, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `k-math-resultados-${currentPin}-${Date.now()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
});
