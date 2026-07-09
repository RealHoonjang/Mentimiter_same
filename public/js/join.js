const socket = io();

let joinedCode = null;
let hasAnswered = false;
let currentType = null;

const params = new URLSearchParams(window.location.search);
const prefillCode = params.get('code');
if (prefillCode) {
  document.getElementById('codeInput').value = prefillCode.toUpperCase();
}

document.getElementById('codeInput').addEventListener('input', (e) => {
  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
});

document.getElementById('codeInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinSession();
});

function joinSession() {
  const code = document.getElementById('codeInput').value.trim();
  if (code.length !== 6) {
    showToast('6자리 코드를 입력해주세요.', 'error');
    return;
  }

  socket.emit('join-session', code, (res) => {
    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }

    joinedCode = code;
    currentType = res.type;
    showView('waitingView');
    document.getElementById('joinedCode').textContent = code;
    document.getElementById('waitingQuestion').textContent = res.question || '질문 대기 중...';

    if (res.isActive) {
      handlePollStarted(res);
    }
  });
}

function normalizeOptions(options) {
  if (!options) return [];
  return options.map((opt) => (typeof opt === 'string' ? opt : opt.text));
}

function handlePollStarted(data) {
  if (hasAnswered) {
    showView('submittedView');
    return;
  }

  if (data.type === 'choice') {
    showChoiceView(data.question, normalizeOptions(data.options));
  } else {
    showTextView(data.question);
  }
}

function showChoiceView(question, options) {
  showView('choiceView');
  document.getElementById('choiceQuestion').textContent = question;
  const container = document.getElementById('choiceButtons');
  container.innerHTML = '';
  options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = opt;
    btn.addEventListener('click', () => submitChoice(opt));
    container.appendChild(btn);
  });
}

function showTextView(question) {
  showView('textView');
  document.getElementById('textQuestion').textContent = question;
  document.getElementById('textAnswer').value = '';
  document.getElementById('textAnswer').focus();
}

function submitChoice(answer) {
  if (hasAnswered) return;

  document.querySelectorAll('.choice-btn').forEach((btn) => {
    btn.disabled = true;
    if (btn.textContent === answer) btn.classList.add('selected');
  });

  socket.emit('submit-answer', answer, (res) => {
    if (!res.success) {
      showToast(res.error, 'error');
      document.querySelectorAll('.choice-btn').forEach((btn) => {
        btn.disabled = false;
        btn.classList.remove('selected');
      });
      return;
    }
    hasAnswered = true;
    showView('submittedView');
  });
}

function submitTextAnswer() {
  if (hasAnswered) return;

  const answer = document.getElementById('textAnswer').value.trim();
  if (!answer) {
    showToast('답변을 입력해주세요.', 'error');
    return;
  }

  socket.emit('submit-answer', answer, (res) => {
    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }
    hasAnswered = true;
    showView('submittedView');
  });
}

function showView(viewId) {
  ['joinForm', 'waitingView', 'choiceView', 'textView', 'submittedView'].forEach((id) => {
    document.getElementById(id).classList.toggle('hidden', id !== viewId);
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

socket.on('question-updated', (data) => {
  document.getElementById('waitingQuestion').textContent = data.question;
  currentType = data.type;
});

socket.on('poll-started', (data) => {
  hasAnswered = false;
  handlePollStarted(data);
});

socket.on('poll-stopped', () => {
  if (!hasAnswered) {
    showView('waitingView');
    showToast('설문이 종료되었습니다.', 'error');
  }
});

socket.on('poll-reset', () => {
  hasAnswered = false;
  showView('waitingView');
});

socket.on('session-ended', () => {
  showToast('호스트가 세션을 종료했습니다.', 'error');
  setTimeout(() => {
    window.location.href = '/join.html';
  }, 2000);
});

document.getElementById('textAnswer')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    submitTextAnswer();
  }
});

if (prefillCode && prefillCode.length === 6) {
  joinSession();
}
