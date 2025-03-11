const express = require('express');
const app = express();
const http = require('http').createServer(app);
const { v4: uuidv4 } = require('uuid');
const { executeCode } = require('./codeExecutorDirect');
const path = require('path');

const corsOrigin = process.env.CORS_ORIGIN || '*';
const PORT = process.env.PORT || 5001;

// Обслуживание статических файлов из папки build
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, 'public');
  console.log('Serving static files from:', buildPath);

  try {
    console.log('Directory contents:', require('fs').readdirSync(buildPath));
    app.use(express.static(buildPath));

    // Важно: этот маршрут должен быть после всех остальных маршрутов API
    app.get('/*', (req, res) => {
      console.log('Serving index.html for path:', req.url);
      res.sendFile(path.join(buildPath, 'index.html'));
    });
  } catch (error) {
    console.error('Error serving static files:', error);
  }
}

const io = require('socket.io')(http, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"]
  }
});

// Добавляем CORS middleware для Express
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', corsOrigin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Добавляем простой эндпоинт для проверки работоспособности
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Хранилище активных сессий
const sessions = new Map();
const users = new Map(); // Хранилище имен пользователей

// Обработка WebSocket соединений
io.on('connection', (socket) => {
  console.log('Пользователь подключился');

  // Создание новой сессии
  socket.on('create_session', (language) => {
    const sessionId = uuidv4();
    sessions.set(sessionId, {
      language,
      code: '',
      participants: new Set([socket.id])
    });
    socket.join(sessionId);
    socket.emit('session_created', sessionId);
  });

  // Присоединение к существующей сессии
  socket.on('join_session', (sessionId) => {
    const session = sessions.get(sessionId);
    if (session) {
      session.participants.add(socket.id);
      socket.join(sessionId);
      socket.sessionId = sessionId;
      socket.userId = socket.id;
      // Отправляем начальное состояние сессии
      socket.emit('session_joined', {
        code: session.code,
        language: session.language
      });
    }
  });

  // Обновление кода
  socket.on('code_change', ({ sessionId, code }) => {
    const session = sessions.get(sessionId);
    if (session) {
      session.code = code;
      socket.to(sessionId).emit('code_update', code);
    }
  });

  // Выполнение кода
  socket.on('execute_code', async ({ sessionId, code }) => {
    const session = sessions.get(sessionId);
    if (session) {
      try {
        const result = await executeCode(session.language, code);
        io.to(sessionId).emit('execution_result', result);
      } catch (error) {
        io.to(sessionId).emit('execution_error', error.message);
      }
    }
  });

  // Установка имени пользователя
  socket.on('set_user_name', ({ fullName }) => {
    users.set(socket.id, fullName);
  });

  // Обновим обработчик выделения
  socket.on('selection_change', ({ sessionId, selection, userName }) => {
    // Отправляем информацию о выделении всем пользователям в сессии, кроме отправителя
    socket.to(sessionId).emit('selection_update', {
      userId: socket.id,
      selection,
      userName: userName || 'Аноним'
    });
  });

  socket.on('disconnect', () => {
    if (socket.sessionId) {
      io.to(socket.sessionId).emit('user_disconnected', {
        userId: socket.id,
        userName: users.get(socket.id)
      });
      users.delete(socket.id);
    }
  });
});

http.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});