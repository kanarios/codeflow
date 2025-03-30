const express = require('express');
const app = express();
const http = require('http').createServer(app);
const { v4: uuidv4 } = require('uuid');
const { executeCode } = require('./codeExecutorDirect');
const path = require('path');

const corsOrigin = process.env.CORS_ORIGIN || '*';
const PORT = process.env.PORT || 5001;

// Serving static files from build folder
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, 'public');
  console.log('Serving static files from:', buildPath);

  try {
    console.log('Directory contents:', require('fs').readdirSync(buildPath));
    app.use(express.static(buildPath));

    // Important: this route should be after all other API routes
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

// Add CORS middleware for Express
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', corsOrigin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Add a simple health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Storage of active sessions
const sessions = new Map();
const users = new Map(); // Storage of user names

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('User connected');

  // Creating a new session
  socket.on('create_session', (language) => {
    const sessionId = uuidv4();
    sessions.set(sessionId, {
      language,
      code: '',
      participants: new Set([socket.id])
    });
    socket.join(sessionId);
    socket.sessionId = sessionId;
    socket.emit('session_created', sessionId);

    // Send information about the new participant to everyone in the session
    const participantsInfo = Array.from(sessions.get(sessionId).participants).map(id => ({
      userId: id,
      userName: users.get(id) || 'Anonymous'
    }));

    // Send updated list to all participants
    io.to(sessionId).emit('participants_update', participantsInfo);
  });

  // Joining an existing session
  socket.on('join_session', (sessionId) => {
    const session = sessions.get(sessionId);
    if (session) {
      session.participants.add(socket.id);
      socket.join(sessionId);
      socket.sessionId = sessionId;

      // Send initial session state
      socket.emit('session_joined', {
        code: session.code,
        language: session.language
      });

      // Send information about the new participant to everyone in the session
      const participantsInfo = Array.from(session.participants).map(id => ({
        userId: id,
        userName: users.get(id) || 'Anonymous'
      }));

      console.log(`User ${socket.id} joined session ${sessionId}. Participants list:`, participantsInfo);

      // Send updated list to all participants
      io.to(sessionId).emit('participants_update', participantsInfo);
    }
  });

  // Code update
  socket.on('code_change', ({ sessionId, code }) => {
    const session = sessions.get(sessionId);
    if (session) {
      session.code = code;
      socket.to(sessionId).emit('code_update', code);
    }
  });

  // Code execution
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

  // Setting user name
  socket.on('set_user_name', ({ fullName }) => {
    console.log(`User ${socket.id} set name: ${fullName}`);
    users.set(socket.id, fullName);

    // If the user is in a session, send updated information to all participants
    if (socket.sessionId) {
      const session = sessions.get(socket.sessionId);
      if (session) {
        const participantsInfo = Array.from(session.participants).map(id => ({
          userId: id,
          userName: users.get(id) || 'Anonymous'
        }));
        console.log(`Sending updated participants list for session ${socket.sessionId}:`, participantsInfo);
        io.to(socket.sessionId).emit('participants_update', participantsInfo);
      }
    }
  });

  // Update selection handler
  socket.on('selection_change', ({ sessionId, selection, userName }) => {
    // Send selection information to all users in the session except the sender
    socket.to(sessionId).emit('selection_update', {
      userId: socket.id,
      selection,
      userName: userName || 'Anonymous'
    });
  });

  socket.on('disconnect', () => {
    console.log(`User ${socket.id} disconnected`);

    if (socket.sessionId) {
      const session = sessions.get(socket.sessionId);
      if (session) {
        // Remove user from session participants list
        session.participants.delete(socket.id);

        // Send notification about user leaving
        io.to(socket.sessionId).emit('user_disconnected', {
          userId: socket.id,
          userName: users.get(socket.id)
        });

        // Send updated participants list
        const participantsInfo = Array.from(session.participants).map(id => ({
          userId: id,
          userName: users.get(id) || 'Anonymous'
        }));

        console.log(`Updated participants list after user ${socket.id} disconnection:`, participantsInfo);

        io.to(socket.sessionId).emit('participants_update', participantsInfo);

        // If no participants left in the session, delete it
        if (session.participants.size === 0) {
          console.log(`Session ${socket.sessionId} deleted as no participants left`);
          sessions.delete(socket.sessionId);
        }
      }
      users.delete(socket.id);
    }
  });
});

http.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});