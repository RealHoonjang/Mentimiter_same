const express = require('express');
const http = require('http');
const os = require('os');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// roomCode -> session data
const sessions = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  if (sessions.has(code)) return generateRoomCode();
  return code;
}

function createEmptySession() {
  return {
    id: uuidv4(),
    question: '',
    type: 'choice', // 'choice' | 'text'
    options: [],
    isActive: false,
    votes: {},
    textAnswers: [],
    participantCount: 0,
    hostSocketId: null,
  };
}

function getResults(session) {
  if (session.type === 'choice') {
    const total = Object.values(session.votes).reduce((sum, n) => sum + n, 0);
    return {
      type: 'choice',
      question: session.question,
      options: session.options.map((opt) => ({
        text: opt,
        count: session.votes[opt] || 0,
        percentage: total > 0 ? Math.round(((session.votes[opt] || 0) / total) * 100) : 0,
      })),
      total,
      isActive: session.isActive,
    };
  }

  return {
    type: 'text',
    question: session.question,
    answers: [...session.textAnswers],
    total: session.textAnswers.length,
    isActive: session.isActive,
  };
}

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

app.get('/api/host-info', (req, res) => {
  res.json({
    ip: getLocalIp(),
    port: PORT,
  });
});

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  socket.on('create-session', (callback) => {
    const code = generateRoomCode();
    const session = createEmptySession();
    session.hostSocketId = socket.id;
    sessions.set(code, session);
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.role = 'host';
    callback({ success: true, code });
  });

  socket.on('setup-question', ({ question, type, options }, callback) => {
    const code = socket.data.roomCode;
    if (!code || socket.data.role !== 'host') {
      callback({ success: false, error: '권한이 없습니다.' });
      return;
    }

    const session = sessions.get(code);
    if (!session) {
      callback({ success: false, error: '세션을 찾을 수 없습니다.' });
      return;
    }

    session.question = question.trim();
    session.type = type;
    session.options = type === 'choice' ? options.map((o) => o.trim()).filter(Boolean) : [];
    session.votes = {};
    session.options.forEach((opt) => {
      session.votes[opt] = 0;
    });
    session.textAnswers = [];
    session.isActive = false;

    callback({ success: true });
    io.to(code).emit('question-updated', {
      question: session.question,
      type: session.type,
      options: session.options,
      isActive: session.isActive,
    });
  });

  socket.on('start-poll', (callback) => {
    const code = socket.data.roomCode;
    if (!code || socket.data.role !== 'host') {
      callback({ success: false, error: '권한이 없습니다.' });
      return;
    }

    const session = sessions.get(code);
    if (!session || !session.question) {
      callback({ success: false, error: '질문을 먼저 설정해주세요.' });
      return;
    }

    if (session.type === 'choice' && session.options.length < 2) {
      callback({ success: false, error: '객관식은 최소 2개의 선택지가 필요합니다.' });
      return;
    }

    session.isActive = true;
    session.votes = {};
    session.options.forEach((opt) => {
      session.votes[opt] = 0;
    });
    session.textAnswers = [];

    callback({ success: true });
    io.to(code).emit('poll-started', getResults(session));
  });

  socket.on('stop-poll', (callback) => {
    const code = socket.data.roomCode;
    if (!code || socket.data.role !== 'host') {
      callback({ success: false, error: '권한이 없습니다.' });
      return;
    }

    const session = sessions.get(code);
    if (!session) {
      callback({ success: false, error: '세션을 찾을 수 없습니다.' });
      return;
    }

    session.isActive = false;
    callback({ success: true });
    io.to(code).emit('poll-stopped', getResults(session));
  });

  socket.on('reset-poll', (callback) => {
    const code = socket.data.roomCode;
    if (!code || socket.data.role !== 'host') {
      callback({ success: false, error: '권한이 없습니다.' });
      return;
    }

    const session = sessions.get(code);
    if (!session) {
      callback({ success: false, error: '세션을 찾을 수 없습니다.' });
      return;
    }

    session.isActive = false;
    session.votes = {};
    session.options.forEach((opt) => {
      session.votes[opt] = 0;
    });
    session.textAnswers = [];

    callback({ success: true });
    io.to(code).emit('poll-reset', getResults(session));
  });

  socket.on('join-session', (code, callback) => {
    const upperCode = (code || '').toUpperCase().trim();
    const session = sessions.get(upperCode);

    if (!session) {
      callback({ success: false, error: '존재하지 않는 세션 코드입니다.' });
      return;
    }

    socket.join(upperCode);
    socket.data.roomCode = upperCode;
    socket.data.role = 'participant';
    socket.data.hasAnswered = false;
    session.participantCount++;

    callback({
      success: true,
      question: session.question,
      type: session.type,
      options: session.options,
      isActive: session.isActive,
      results: session.isActive ? getResults(session) : null,
    });

    io.to(upperCode).emit('participant-count', session.participantCount);
  });

  socket.on('submit-answer', (answer, callback) => {
    const code = socket.data.roomCode;
    if (!code || socket.data.role !== 'participant') {
      callback({ success: false, error: '권한이 없습니다.' });
      return;
    }

    if (socket.data.hasAnswered) {
      callback({ success: false, error: '이미 답변을 제출했습니다.' });
      return;
    }

    const session = sessions.get(code);
    if (!session || !session.isActive) {
      callback({ success: false, error: '현재 설문이 진행 중이 아닙니다.' });
      return;
    }

    if (session.type === 'choice') {
      if (!session.options.includes(answer)) {
        callback({ success: false, error: '유효하지 않은 선택지입니다.' });
        return;
      }
      session.votes[answer] = (session.votes[answer] || 0) + 1;
    } else {
      const trimmed = (answer || '').trim();
      if (!trimmed) {
        callback({ success: false, error: '답변을 입력해주세요.' });
        return;
      }
      session.textAnswers.push({
        id: uuidv4(),
        text: trimmed,
        timestamp: Date.now(),
      });
    }

    socket.data.hasAnswered = true;
    callback({ success: true });

    const results = getResults(session);
    io.to(code).emit('results-updated', results);
  });

  socket.on('get-results', (callback) => {
    const code = socket.data.roomCode;
    const session = sessions.get(code);
    if (!session) {
      callback({ success: false, error: '세션을 찾을 수 없습니다.' });
      return;
    }
    callback({ success: true, results: getResults(session) });
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    if (!code) return;

    const session = sessions.get(code);
    if (!session) return;

    if (socket.data.role === 'participant') {
      session.participantCount = Math.max(0, session.participantCount - 1);
      io.to(code).emit('participant-count', session.participantCount);
    }

    if (socket.data.role === 'host' && session.hostSocketId === socket.id) {
      sessions.delete(code);
      io.to(code).emit('session-ended');
    }
  });
});

server.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
