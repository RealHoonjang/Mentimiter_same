const socket = io();

const params = new URLSearchParams(window.location.search);
const code = params.get('code');

if (!code) {
  document.getElementById('loadingView').innerHTML =
    '<h2>코드가 필요합니다</h2><p>호스트 페이지에서 발표 화면 링크를 열어주세요.</p>';
} else {
  socket.emit('join-session', code, (res) => {
    if (!res.success) {
      document.getElementById('loadingView').innerHTML =
        `<h2>연결 실패</h2><p>${res.error}</p>`;
      return;
    }

    document.getElementById('loadingView').classList.add('hidden');
    document.getElementById('presentView').classList.remove('hidden');
    document.getElementById('presentQuestion').textContent = res.question || '질문 대기 중...';

    document.getElementById('presentRoomCode').textContent = code;
    document.getElementById('presentQrBox').classList.remove('hidden');
    setupShare(code, { qrImageId: 'presentQrImage', qrSize: 120 });

    if (res.isActive && res.results) {
      setActive(true);
      renderPresentResults(res.results);
    }
  });
}

function setActive(active) {
  const badge = document.getElementById('presentBadge');
  badge.className = active ? 'badge badge-live' : 'badge badge-waiting';
  badge.textContent = active ? '진행 중' : '대기 중';
}

function renderPresentResults(results) {
  const area = document.getElementById('presentResults');
  const stats = document.getElementById('presentStats');

  document.getElementById('presentQuestion').textContent = results.question;
  stats.textContent = `총 ${results.total}개의 응답`;

  if (results.type === 'choice') {
    const maxCount = Math.max(...results.options.map((o) => o.count), 1);
    area.innerHTML = `
      <div class="bar-chart present-bar-chart">
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
      area.innerHTML =
        '<div class="waiting-state"><p>답변을 기다리는 중...</p></div>';
      return;
    }
    area.innerHTML = `
      <div class="text-answers present-text-answers">
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

socket.on('question-updated', (data) => {
  document.getElementById('presentQuestion').textContent = data.question;
});

socket.on('poll-started', (results) => {
  setActive(true);
  renderPresentResults(results);
});

socket.on('poll-stopped', (results) => {
  setActive(false);
  renderPresentResults(results);
});

socket.on('poll-reset', (results) => {
  setActive(false);
  renderPresentResults(results);
});

socket.on('results-updated', (results) => {
  renderPresentResults(results);
});

socket.on('participant-count', (count) => {
  document.getElementById('presentCount').textContent = count;
});

socket.on('session-ended', () => {
  document.getElementById('presentView').innerHTML =
    '<div class="waiting-state"><h2>세션이 종료되었습니다</h2></div>';
});
