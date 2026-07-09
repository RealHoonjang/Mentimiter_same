const socket = io();

let selectedType = 'choice';
let roomCode = null;
let isPollActive = false;

document.querySelectorAll('.type-option').forEach((el) => {
  el.addEventListener('click', () => {
    document.querySelectorAll('.type-option').forEach((o) => o.classList.remove('active'));
    el.classList.add('active');
    selectedType = el.dataset.type;
    document.getElementById('optionsSection').classList.toggle('hidden', selectedType === 'text');
    updatePreview();
  });
});

document.getElementById('questionInput').addEventListener('input', updatePreview);
document.querySelectorAll('.option-input').forEach((input) => {
  input.addEventListener('input', updatePreview);
});

function addOption() {
  const list = document.getElementById('optionsList');
  const count = list.children.length + 1;
  const item = document.createElement('div');
  item.className = 'option-item';
  item.innerHTML = `
    <input type="text" class="option-input" placeholder="선택지 ${count}">
    <button class="btn-remove" onclick="removeOption(this)" title="삭제">×</button>
  `;
  list.appendChild(item);
  item.querySelector('input').addEventListener('input', updatePreview);
  updatePreview();
}

function removeOption(btn) {
  const list = document.getElementById('optionsList');
  if (list.children.length <= 2) {
    showToast('최소 2개의 선택지가 필요합니다.', 'error');
    return;
  }
  btn.parentElement.remove();
  updatePreview();
}

function getOptions() {
  return Array.from(document.querySelectorAll('.option-input'))
    .map((input) => input.value.trim())
    .filter(Boolean);
}

function updatePreview() {
  const question = document.getElementById('questionInput').value.trim();
  const preview = document.getElementById('previewQuestion');
  preview.textContent = question || '질문을 입력하세요';

  const content = document.getElementById('previewContent');
  if (selectedType === 'choice') {
    const options = getOptions();
    content.innerHTML = options.length
      ? options.map((o) => `<div class="choice-btn" style="pointer-events:none; margin-bottom:0.5rem;">${escapeHtml(o)}</div>`).join('')
      : '<p>선택지를 입력하세요</p>';
  } else {
    content.innerHTML = '<textarea placeholder="자유롭게 답변을 입력하세요..." disabled style="opacity:0.7;"></textarea>';
  }
}

function saveQuestion() {
  const question = document.getElementById('questionInput').value.trim();
  if (!question) {
    showToast('질문을 입력해주세요.', 'error');
    return;
  }

  if (selectedType === 'choice') {
    const options = getOptions();
    if (options.length < 2) {
      showToast('객관식은 최소 2개의 선택지가 필요합니다.', 'error');
      return;
    }
  }

  const btn = document.getElementById('createBtn');
  btn.disabled = true;
  btn.textContent = roomCode ? '저장 중...' : '생성 중...';

  const finishSetup = (setupRes) => {
    if (!setupRes.success) {
      showToast(setupRes.error || '질문 설정 실패', 'error');
      btn.disabled = false;
      btn.textContent = roomCode ? '변경사항 저장' : '세션 생성하기';
      return;
    }
    showActivePhase(question);
  };

  if (roomCode) {
    socket.emit('setup-question', { question, type: selectedType, options: getOptions() }, finishSetup);
    return;
  }

  socket.emit('create-session', (res) => {
    if (!res.success) {
      showToast(res.error || '세션 생성 실패', 'error');
      btn.disabled = false;
      btn.textContent = '세션 생성하기';
      return;
    }

    roomCode = res.code;
    socket.emit('setup-question', { question, type: selectedType, options: getOptions() }, finishSetup);
  });
}

function createSession() {
  saveQuestion();
}

function showActivePhase(question) {
  document.getElementById('setupPhase').classList.add('hidden');
  document.getElementById('activePhase').classList.remove('hidden');
  document.getElementById('statusArea').classList.remove('hidden');
  document.getElementById('roomCode').textContent = roomCode;
  document.getElementById('activeQuestion').textContent = question;
  document.getElementById('activeType').textContent =
    selectedType === 'choice' ? '📊 객관식' : '💬 주관식';
  document.getElementById('presentLink').href = `/present.html?code=${roomCode}`;

  setupShare(roomCode, {
    qrImageId: 'qrImage',
    urlInputId: 'joinUrlInput',
    hintId: 'networkHint',
  });
}

async function copyJoinUrlHandler() {
  const copied = await copyJoinUrl('joinUrlInput');
  if (copied) showToast('참가 URL이 복사되었습니다.');
}

function startPoll() {
  socket.emit('start-poll', (res) => {
    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }
    setPollActive(true);
  });
}

function stopPoll() {
  socket.emit('stop-poll', (res) => {
    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }
    setPollActive(false);
  });
}

function resetPoll() {
  socket.emit('reset-poll', (res) => {
    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }
    setPollActive(false);
    renderResults({ type: selectedType, options: getOptions().map((o) => ({ text: o, count: 0, percentage: 0 })), answers: [], total: 0, isActive: false });
  });
}

function editQuestion() {
  if (isPollActive) {
    showToast('설문 진행 중에는 수정할 수 없습니다. 먼저 중지해주세요.', 'error');
    return;
  }
  document.getElementById('setupPhase').classList.remove('hidden');
  document.getElementById('activePhase').classList.add('hidden');
  document.getElementById('createBtn').disabled = false;
  document.getElementById('createBtn').textContent = '변경사항 저장';
}

function setPollActive(active) {
  isPollActive = active;
  const badge = document.getElementById('statusBadge');
  badge.className = active ? 'badge badge-live' : 'badge badge-waiting';
  badge.textContent = active ? '진행 중' : '대기 중';

  document.getElementById('startBtn').classList.toggle('hidden', active);
  document.getElementById('stopBtn').classList.toggle('hidden', !active);
  document.getElementById('resetBtn').classList.toggle('hidden', !active);
}

function renderResults(results) {
  const area = document.getElementById('resultsArea');
  const stats = document.getElementById('totalResponses');

  if (!results || results.total === 0) {
    if (!results?.isActive) {
      area.innerHTML = '<div class="waiting-state"><p>설문을 시작하면 결과가 여기에 표시됩니다.</p></div>';
      stats.textContent = '';
      return;
    }
  }

  stats.textContent = `총 ${results.total}개의 응답`;

  if (results.type === 'choice') {
    const maxCount = Math.max(...results.options.map((o) => o.count), 1);
    area.innerHTML = `
      <div class="bar-chart">
        ${results.options
          .map(
            (opt) => `
          <div class="bar-item">
            <div class="bar-header">
              <span class="bar-label">${escapeHtml(opt.text)}</span>
              <span class="bar-stats">${opt.count}표 (${opt.percentage}%)</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill" style="width: ${maxCount > 0 ? (opt.count / maxCount) * 100 : 0}%">
                <span>${opt.percentage}%</span>
              </div>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;
  } else {
    if (results.answers.length === 0) {
      area.innerHTML = '<div class="waiting-state"><p>아직 답변이 없습니다. 첫 번째 답변을 기다리는 중...</p></div>';
      return;
    }
    area.innerHTML = `
      <div class="text-answers">
        ${results.answers
          .slice()
          .reverse()
          .map((a) => `<div class="text-answer-item">${escapeHtml(a.text)}</div>`)
          .join('')}
      </div>
    `;
  }
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

socket.on('poll-started', (results) => {
  setPollActive(true);
  renderResults(results);
});

socket.on('poll-stopped', (results) => {
  setPollActive(false);
  renderResults(results);
});

socket.on('poll-reset', (results) => {
  setPollActive(false);
  renderResults(results);
});

socket.on('results-updated', (results) => {
  renderResults(results);
});

socket.on('participant-count', (count) => {
  document.getElementById('participantCount').textContent = count;
});

socket.on('session-ended', () => {
  showToast('세션이 종료되었습니다.', 'error');
});

updatePreview();
