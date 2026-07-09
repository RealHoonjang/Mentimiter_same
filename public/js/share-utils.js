let cachedHostInfo = null;

async function fetchHostInfo() {
  if (cachedHostInfo) return cachedHostInfo;
  try {
    const res = await fetch('/api/host-info');
    cachedHostInfo = await res.json();
  } catch {
    cachedHostInfo = { ip: null, port: window.location.port || '3000' };
  }
  return cachedHostInfo;
}

function getShareBaseUrl(hostInfo) {
  const { hostname, port, protocol } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    if (hostInfo?.ip) {
      return `${protocol}//${hostInfo.ip}:${hostInfo.port || port || 3000}`;
    }
  }
  return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
}

function buildJoinUrl(code, hostInfo) {
  return `${getShareBaseUrl(hostInfo)}/join.html?code=${encodeURIComponent(code)}`;
}

async function renderQrCode(canvas, url, size = 200) {
  if (!canvas || typeof QRCode === 'undefined') return;
  await QRCode.toCanvas(canvas, url, {
    width: size,
    margin: 2,
    color: { dark: '#1a1230', light: '#ffffff' },
  });
}

async function setupShare(code, options = {}) {
  const { canvasId, urlInputId, hintId, qrSize = 200 } = options;
  const hostInfo = await fetchHostInfo();
  const joinUrl = buildJoinUrl(code, hostInfo);

  if (urlInputId) {
    const input = document.getElementById(urlInputId);
    if (input) input.value = joinUrl;
  }

  if (hintId) {
    const hint = document.getElementById(hintId);
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (hint && isLocal && hostInfo.ip) {
      hint.textContent = `같은 Wi-Fi 참가자는 이 URL 또는 QR 코드를 사용하세요.`;
      hint.classList.remove('hidden');
    } else if (hint) {
      hint.classList.add('hidden');
    }
  }

  if (canvasId) {
    const canvas = document.getElementById(canvasId);
    await renderQrCode(canvas, joinUrl, qrSize);
  }

  return joinUrl;
}

async function copyJoinUrl(inputId) {
  const input = document.getElementById(inputId);
  const url = input?.value;
  if (!url) return false;

  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    input.select();
    document.execCommand('copy');
    return true;
  }
}
