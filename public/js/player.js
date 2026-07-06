// player.js - Lógica del Mando Móvil (Estudiante) con Sonidos Mejorados

const socket = io();

// Variables de estado
let myPin = null;
let myNickname = '';
let myAvatar = '👾';
let myScore = 0;
let questionStartTime = 0;
let currentQuestionIndex = 0;
let totalQuestions = 0;

// Elementos del DOM
const joinScreen = document.getElementById('joinScreen');
const waitingScreen = document.getElementById('waitingScreen');
const controllerScreen = document.getElementById('controllerScreen');
const answeredScreen = document.getElementById('answeredScreen');
const feedbackScreen = document.getElementById('feedbackScreen');
const finalScreen = document.getElementById('finalScreen');

const joinForm = document.getElementById('joinForm');
const pinInput = document.getElementById('pinInput');
const nicknameInput = document.getElementById('nicknameInput');
const avatarSelector = document.getElementById('avatarSelector');
const errorMsg = document.getElementById('errorMsg');

const myAvatarDisplay = document.getElementById('myAvatarDisplay');
const myNicknameDisplay = document.getElementById('myNicknameDisplay');
const playerScoreBadge = document.getElementById('playerScoreBadge');
const playerQuestionCounter = document.getElementById('playerQuestionCounter');

// Elementos de feedback
const feedbackBox = document.getElementById('feedbackBox');
const feedbackIcon = document.getElementById('feedbackIcon');
const feedbackTitle = document.getElementById('feedbackTitle');
const feedbackPoints = document.getElementById('feedbackPoints');
const streakBadge = document.getElementById('streakBadge');
const finalScoreDisplay = document.getElementById('finalScoreDisplay');

// 1. Autocompletar PIN si viene en la URL (ej. al escanear QR: ?pin=4829)
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const pinParam = urlParams.get('pin');
  if (pinParam) {
    pinInput.value = pinParam;
    nicknameInput.focus();
  }
});

// 2. Selección de Avatar
avatarSelector.addEventListener('click', (e) => {
  const target = e.target.closest('.avatar-option');
  if (!target) return;

  document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
  target.classList.add('selected');
  myAvatar = target.textContent.trim();
  soundFX.playTone(600, 'sine', 0.08, 0.06);
});

// 3. Enviar formulario para unirse a la sala
joinForm.addEventListener('submit', (e) => {
  e.preventDefault();
  errorMsg.style.display = 'none';

  const pin = pinInput.value.trim();
  const nickname = nicknameInput.value.trim();

  if (pin.length < 4 || !nickname) {
    showError('Por favor ingresa un PIN válido de 4 dígitos y tu apodo.');
    return;
  }

  myPin = pin;
  myNickname = nickname;

  socket.emit('join-game', {
    pin: myPin,
    nickname: myNickname,
    avatar: myAvatar
  });
});

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.style.display = 'block';
  soundFX.playWrong();
}

// Evento: Unión exitosa
socket.on('join-success', ({ pin, nickname, quizTitle }) => {
  joinScreen.classList.add('hidden');
  waitingScreen.classList.remove('hidden');
  playerScoreBadge.classList.remove('hidden');

  myAvatarDisplay.textContent = myAvatar;
  myNicknameDisplay.textContent = `${myAvatar} ${myNickname}`;
  playerScoreBadge.textContent = '0 pts';

  soundFX.playStart();
  if (navigator.vibrate) navigator.vibrate(100);
});

// Evento: Error al unirse
socket.on('join-error', ({ message }) => {
  showError(message);
});

// 4. Evento: Empieza una pregunta
socket.on('question-start', ({ questionIndex, totalQuestions: total }) => {
  soundFX.stopThinkingMusic();
  
  waitingScreen.classList.add('hidden');
  answeredScreen.classList.add('hidden');
  feedbackScreen.classList.add('hidden');
  controllerScreen.classList.remove('hidden');

  currentQuestionIndex = questionIndex;
  totalQuestions = total;
  playerQuestionCounter.textContent = `Pregunta ${questionIndex + 1} de ${totalQuestions}`;

  questionStartTime = Date.now();
  
  // Acorde inicial y música de suspenso en el móvil
  soundFX.playStart();
  setTimeout(() => {
    soundFX.playThinkingMusic();
  }, 400);

  if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
});

// 5. Alumno toca uno de los 4 botones de color
function submitAnswer(answerIndex) {
  if (!myPin) return;

  soundFX.stopThinkingMusic();

  socket.emit('submit-answer', {
    pin: myPin,
    answerIndex: answerIndex
  });

  // Ocultar mando y mostrar pantalla de espera de resultados
  controllerScreen.classList.add('hidden');
  answeredScreen.classList.remove('hidden');

  soundFX.playTone(600, 'sine', 0.1, 0.1);
  if (navigator.vibrate) navigator.vibrate(80);
}

// Evento: Confirmación de respuesta
socket.on('answer-confirm', () => {
  // Ya estamos en answeredScreen
});

// 6. Evento: Resultados de la pregunta (Feedback personal)
socket.on('player-result', ({ correct, pointsEarned, score, streak, timeOut }) => {
  soundFX.stopThinkingMusic();
  
  answeredScreen.classList.add('hidden');
  controllerScreen.classList.add('hidden');
  feedbackScreen.classList.remove('hidden');

  myScore = score;
  playerScoreBadge.textContent = `${myScore} pts`;

  if (correct) {
    feedbackBox.className = 'feedback-screen correct';
    feedbackIcon.textContent = '✓';
    feedbackTitle.textContent = '¡CORRECTO!';
    feedbackPoints.textContent = `+${pointsEarned} pts`;
    
    if (streak > 1) {
      streakBadge.style.display = 'inline-block';
      streakBadge.textContent = `🔥 Racha x${streak} (+${Math.min((streak - 1) * 100, 500)} bono)`;
    } else {
      streakBadge.style.display = 'none';
    }

    soundFX.playCorrect();
    if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
  } else {
    feedbackBox.className = 'feedback-screen wrong';
    feedbackIcon.textContent = timeOut ? '⌛' : '✗';
    feedbackTitle.textContent = timeOut ? '¡TIEMPO AGOTADO!' : '¡INCORRECTO!';
    feedbackPoints.textContent = '+0 pts';
    streakBadge.style.display = 'none';

    soundFX.playWrong();
    if (navigator.vibrate) navigator.vibrate(400);
  }
});

// 7. Evento: Fin de juego y podio
socket.on('game-over', ({ podium, standings }) => {
  soundFX.stopThinkingMusic();
  soundFX.stopLobbyMusic();
  
  feedbackScreen.classList.add('hidden');
  controllerScreen.classList.add('hidden');
  answeredScreen.classList.add('hidden');
  finalScreen.classList.remove('hidden');

  finalScoreDisplay.textContent = `${myScore} pts`;
  triggerConfetti(document.body, 60);
  soundFX.playFanfare();
  if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
});

// Evento: Sala cerrada por el profesor
socket.on('game-terminated', ({ message }) => {
  soundFX.stopThinkingMusic();
  soundFX.stopLobbyMusic();
  alert(message || 'La sala fue cerrada.');
  window.location.href = 'index.html';
});
