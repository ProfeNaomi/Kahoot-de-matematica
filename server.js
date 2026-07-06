const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const qrcode = require('qrcode');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Obtener dirección IP local (LAN/Wi-Fi) del servidor
function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Buscar IPv4 externa (no loopback 127.0.0.1)
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1'; // Fallback a localhost
}

// Almacenamiento en memoria de partidas activas (Lobbies)
// Estructura: { "4829": { hostSocketId, quiz, players: { socketId: { nickname, avatar, score, streak, lastAnswer } }, currentQuestionIndex, state, timer } }
const activeGames = {};

// Cargar cuestionarios
const QUIZZES_FILE = path.join(__dirname, 'data', 'quizzes.json');

function loadQuizzes() {
  try {
    const data = fs.readFileSync(QUIZZES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error al cargar cuestionarios:', error);
    return [];
  }
}

function saveQuizzes(quizzes) {
  try {
    fs.writeFileSync(QUIZZES_FILE, JSON.stringify(quizzes, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error al guardar cuestionarios:', error);
    return false;
  }
}

// ==========================================
// REST API ENDPOINTS
// ==========================================

// Obtener IP local del servidor y puerto para construir URLs de QR
app.get('/api/ip', (req, res) => {
  const ip = getLocalIPAddress();
  res.json({ ip, port: PORT, url: `http://${ip}:${PORT}` });
});

// Obtener todos los cuestionarios
app.get('/api/quizzes', (req, res) => {
  const quizzes = loadQuizzes();
  res.json(quizzes);
});

// Obtener un cuestionario específico
app.get('/api/quizzes/:id', (req, res) => {
  const quizzes = loadQuizzes();
  const quiz = quizzes.find(q => q.id === req.params.id);
  if (!quiz) return res.status(404).json({ error: 'Cuestionario no encontrado' });
  res.json(quiz);
});

// Guardar/Crear un nuevo cuestionario
app.post('/api/quizzes', (req, res) => {
  const quizzes = loadQuizzes();
  const newQuiz = req.body;
  
  if (!newQuiz.id || !newQuiz.title || !newQuiz.questions) {
    return res.status(400).json({ error: 'Datos de cuestionario incompletos' });
  }

  const existingIndex = quizzes.findIndex(q => q.id === newQuiz.id);
  if (existingIndex >= 0) {
    quizzes[existingIndex] = newQuiz;
  } else {
    quizzes.push(newQuiz);
  }

  if (saveQuizzes(quizzes)) {
    res.json({ success: true, quiz: newQuiz });
  } else {
    res.status(500).json({ error: 'Error al guardar en el servidor' });
  }
});

// Generar Código QR (devuelve imagen base64 o SVG)
app.get('/api/qr', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Falta parámetro url' });
  
  try {
    const qrDataUrl = await qrcode.toDataURL(url, {
      width: 400,
      margin: 2,
      color: {
        dark: '#ffffff',
        light: '#0a0e17'
      }
    });
    res.json({ qr: qrDataUrl });
  } catch (error) {
    res.status(500).json({ error: 'Error al generar código QR' });
  }
});

// ==========================================
// SOCKET.IO REAL-TIME GAME LOGIC
// ==========================================

function generatePIN() {
  let pin;
  do {
    pin = Math.floor(1000 + Math.random() * 9000).toString();
  } while (activeGames[pin]);
  return pin;
}

io.on('connection', (socket) => {
  console.log(`⚡ Nuevo cliente conectado: ${socket.id}`);

  // --- PROFESOR / HOST ---
  
  // Profesor crea una nueva sala de juego
  socket.on('create-game', ({ quizId }) => {
    const quizzes = loadQuizzes();
    const quiz = quizzes.find(q => q.id === quizId);
    if (!quiz) {
      return socket.emit('error-msg', { message: 'Cuestionario no encontrado' });
    }

    const pin = generatePIN();
    const lanIP = getLocalIPAddress();
    const joinUrl = `http://${lanIP}:${PORT}/play.html?pin=${pin}`;

    activeGames[pin] = {
      pin,
      hostSocketId: socket.id,
      quiz: JSON.parse(JSON.stringify(quiz)), // Copia profunda
      players: {},
      currentQuestionIndex: -1,
      state: 'LOBBY',
      questionStartTime: null
    };

    socket.join(pin);
    console.log(`🎮 Sala creada: PIN ${pin} para el juego "${quiz.title}" (Host: ${socket.id})`);

    // Generar QR y enviar los datos al Host
    qrcode.toDataURL(joinUrl, {
      width: 450,
      margin: 2,
      color: { dark: '#ffffff', light: '#0a0e17' }
    }).then(qrDataUrl => {
      socket.emit('game-created', {
        pin,
        quizTitle: quiz.title,
        joinUrl,
        qrImage: qrDataUrl
      });
    }).catch(err => {
      socket.emit('game-created', {
        pin,
        quizTitle: quiz.title,
        joinUrl,
        qrImage: null
      });
    });
  });

  // Profesor inicia la partida
  socket.on('start-game', ({ pin }) => {
    const game = activeGames[pin];
    if (!game || game.hostSocketId !== socket.id) return;

    if (Object.keys(game.players).length === 0) {
      return socket.emit('error-msg', { message: 'Debes esperar a que al menos 1 estudiante se una.' });
    }

    game.state = 'QUESTION';
    game.currentQuestionIndex = 0;
    sendQuestion(pin);
  });

  // Profesor solicita siguiente pregunta o resultados
  socket.on('next-question', ({ pin }) => {
    const game = activeGames[pin];
    if (!game || game.hostSocketId !== socket.id) return;

    game.currentQuestionIndex++;
    if (game.currentQuestionIndex < game.quiz.questions.length) {
      game.state = 'QUESTION';
      sendQuestion(pin);
    } else {
      game.state = 'PODIUM';
      sendPodium(pin);
    }
  });

  // Profesor corta el tiempo de la pregunta o termina el contador
  socket.on('show-results', ({ pin }) => {
    const game = activeGames[pin];
    if (!game || game.hostSocketId !== socket.id || game.state !== 'QUESTION') return;

    game.state = 'RESULTS';
    const currentQ = game.quiz.questions[game.currentQuestionIndex];
    const distribution = [0, 0, 0, 0];

    // Evaluar respuestas y calcular puntos
    Object.entries(game.players).forEach(([playerId, player]) => {
      if (player.lastAnswer !== null) {
        const { answerIndex, timeTaken } = player.lastAnswer;
        if (answerIndex >= 0 && answerIndex < 4) {
          distribution[answerIndex]++;
        }

        const isCorrect = (answerIndex === currentQ.correctOption);
        let pointsEarned = 0;

        if (isCorrect) {
          player.streak++;
          // Fórmula Kahoot: (1 - (tiempo_tardado / tiempo_total) / 2) * 1000 + bono de racha
          const timeRatio = Math.min(1, timeTaken / (currentQ.timeLimit * 1000));
          const basePoints = Math.round((1 - (timeRatio / 2)) * 1000);
          const streakBonus = Math.min((player.streak - 1) * 100, 500); // Hasta 500 pts por racha
          pointsEarned = basePoints + streakBonus;
          player.score += pointsEarned;
        } else {
          player.streak = 0;
        }

        // Enviar resultado individual al celular de cada alumno
        io.to(playerId).emit('player-result', {
          correct: isCorrect,
          pointsEarned,
          score: player.score,
          streak: player.streak,
          correctOption: currentQ.correctOption
        });
      } else {
        // No respondió a tiempo
        player.streak = 0;
        io.to(playerId).emit('player-result', {
          correct: false,
          pointsEarned: 0,
          score: player.score,
          streak: 0,
          correctOption: currentQ.correctOption,
          timeOut: true
        });
      }
    });

    // Calcular clasificación top 5 para mostrar en proyector
    const leaderboard = Object.values(game.players)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    io.to(game.hostSocketId).emit('question-results', {
      correctOption: currentQ.correctOption,
      distribution,
      leaderboard
    });
  });

  // --- ESTUDIANTE / MANDO MÓVIL ---

  // Alumno se une a la sala con PIN y Nickname
  socket.on('join-game', ({ pin, nickname, avatar }) => {
    const game = activeGames[pin];
    if (!game) {
      return socket.emit('join-error', { message: '¡Ese PIN de sala no existe!' });
    }
    if (game.state !== 'LOBBY') {
      return socket.emit('join-error', { message: 'La partida ya comenzó. ¡Espera a la próxima!' });
    }

    // Verificar apodo duplicado
    const nameExists = Object.values(game.players).some(
      p => p.nickname.toLowerCase() === nickname.trim().toLowerCase()
    );
    if (nameExists) {
      return socket.emit('join-error', { message: 'Ese apodo ya está en uso. ¡Elige otro!' });
    }

    const cleanNickname = nickname.trim().substring(0, 15);
    game.players[socket.id] = {
      id: socket.id,
      nickname: cleanNickname,
      avatar: avatar || '👾',
      score: 0,
      streak: 0,
      lastAnswer: null
    };

    socket.join(pin);
    console.log(`📱 Alumno "${cleanNickname}" se unió a sala ${pin}`);

    // Notificar al alumno que entró con éxito
    socket.emit('join-success', {
      pin,
      nickname: cleanNickname,
      quizTitle: game.quiz.title
    });

    // Notificar al Host que hay un nuevo jugador y actualizar contador
    io.to(game.hostSocketId).emit('player-joined', {
      id: socket.id,
      nickname: cleanNickname,
      avatar: avatar || '👾',
      totalPlayers: Object.keys(game.players).length
    });
  });

  // Alumno responde presionando un color/botón
  socket.on('submit-answer', ({ pin, answerIndex }) => {
    const game = activeGames[pin];
    if (!game || game.state !== 'QUESTION') return;
    const player = game.players[socket.id];
    if (!player || player.lastAnswer !== null) return; // Ya respondió

    const timeTaken = Date.now() - game.questionStartTime;
    player.lastAnswer = { answerIndex, timeTaken };

    // Notificar al Host que este jugador ya respondió para actualizar contador en vivo
    const answeredCount = Object.values(game.players).filter(p => p.lastAnswer !== null).length;
    const totalPlayers = Object.keys(game.players).length;

    io.to(game.hostSocketId).emit('answer-received', {
      answeredCount,
      totalPlayers
    });

    socket.emit('answer-confirm', { message: '¡Respuesta registrada!' });

    // Si ya respondieron todos los alumnos, disparar automáticamente show-results en el Host
    if (answeredCount >= totalPlayers) {
      io.to(game.hostSocketId).emit('all-answered');
    }
  });

  // --- DESCONEXIONES ---
  socket.on('disconnect', () => {
    // Buscar en todas las partidas activas
    for (const pin in activeGames) {
      const game = activeGames[pin];

      // Si se desconecta el Host (Profesor)
      if (game.hostSocketId === socket.id) {
        console.log(`❌ Host desconectado en sala ${pin}. Cerrando sala...`);
        io.to(pin).emit('game-terminated', { message: 'El profesor ha cerrado la sala o perdió conexión.' });
        delete activeGames[pin];
        break;
      }

      // Si se desconecta un Alumno
      if (game.players[socket.id]) {
        const pName = game.players[socket.id].nickname;
        delete game.players[socket.id];
        console.log(`🚪 Alumno "${pName}" salió de sala ${pin}`);
        
        io.to(game.hostSocketId).emit('player-left', {
          id: socket.id,
          totalPlayers: Object.keys(game.players).length
        });
        break;
      }
    }
  });
});

// Funciones auxiliares de envío de estado
function sendQuestion(pin) {
  const game = activeGames[pin];
  if (!game) return;

  const q = game.quiz.questions[game.currentQuestionIndex];
  game.questionStartTime = Date.now();

  // Resetear la respuesta anterior de los jugadores
  Object.values(game.players).forEach(p => p.lastAnswer = null);

  // Enviar pregunta completa AL HOST
  io.to(game.hostSocketId).emit('question-start', {
    questionIndex: game.currentQuestionIndex,
    totalQuestions: game.quiz.questions.length,
    questionText: q.question,
    options: q.options,
    timeLimit: q.timeLimit
  });

  // Enviar inicio de pregunta A LOS ALUMNOS (sin texto ni respuestas correctas para evitar trampas en consola)
  socketEmitToPlayers(pin, 'question-start', {
    questionIndex: game.currentQuestionIndex,
    totalQuestions: game.quiz.questions.length,
    timeLimit: q.timeLimit
  });
}

function sendPodium(pin) {
  const game = activeGames[pin];
  if (!game) return;

  const standings = Object.values(game.players)
    .sort((a, b) => b.score - a.score);

  const podium = standings.slice(0, 3);

  io.to(pin).emit('game-over', {
    podium,
    standings
  });
}

function socketEmitToPlayers(pin, event, data) {
  const game = activeGames[pin];
  if (!game) return;
  Object.keys(game.players).forEach(socketId => {
    io.to(socketId).emit(event, data);
  });
}

// Iniciar el servidor
server.listen(PORT, '0.0.0.0', () => {
  const lanIP = getLocalIPAddress();
  console.log('==================================================');
  console.log(`🚀 SERVIDOR KAHOOT DE MATEMÁTICA INICIADO CON ÉXITO`);
  console.log(`💻 Local (PC):    http://localhost:${PORT}`);
  console.log(`📶 Red Wi-Fi:     http://${lanIP}:${PORT}`);
  console.log('==================================================');
});
