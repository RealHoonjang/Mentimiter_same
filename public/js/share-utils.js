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

function buildJoinUrl(code, hostInfo) {
  const { hostname, protocol, port } = window.location;
  let base;

  if ((hostname === 'localhost' || hostname === '127.0.0.1') && hostInfo?.ip) {
    base = `${protocol}//${hostInfo.ip}:${hostInfo.port || port || 3000}`;
  } else {
    base = window.location.origin;
  }

  return `${base}/join.html?code=${encodeURIComponent(code)}`;
}

function renderQrImage(imgElement, url, size = 200) {
  if (!imgElement || !url) return;
  imgElement.src = `/api/qr?size=${size}&url=${encodeURIComponent(url)}`;
  imgElement.alt = '참가 QR 코드';
}

async function setupShare(code, options = {}) {
  const { qrImageId, urlInputId, hintId, qrSize = 200 } = options;
  const hostInfo = await fetchHostInfo();
  const joinUrl = buildJoinUrl(code, hostInfo);

  if (urlInputId) {
    const input = document.getElementById(urlInputId);
    if (input) {
      input.value = joinUrl;
      input.title = joinUrl;
    }
  }

  if (hintId) {
    const hint = document.getElementById(hintId);
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (hint && isLocal && hostInfo.ip) {
      hint.textContent = '같은 Wi-Fi 참가자는 이 URL 또는 QR 코드를 사용하세요.';
      hint.classList.remove('hidden');
    } else if (hint) {
      hint.classList.add('hidden');
    }
  }

  if (qrImageId) {
    renderQrImage(document.getElementById(qrImageId), joinUrl, qrSize);
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
