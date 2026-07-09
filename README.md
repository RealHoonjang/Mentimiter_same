# LivePoll

실시간 설문조사 웹앱 (멘티미터 대체)

## 로컬 실행

```bash
npm install
npm start
```

브라우저에서 http://localhost:3000 접속

## Render 배포 (GitHub 연동)

### 1. GitHub 저장소 만들기

1. https://github.com/new 에서 새 저장소 생성 (예: `livepoll`)
2. 아래 명령으로 코드 업로드:

```bash
git remote add origin https://github.com/YOUR_USERNAME/livepoll.git
git branch -M main
git push -u origin main
```

### 2. Render에 배포

1. https://render.com 가입/로그인
2. **New +** → **Web Service**
3. **Build and deploy from a Git repository** → GitHub 연결
4. 방금 만든 `livepoll` 저장소 선택
5. 설정:
   - **Name**: livepoll (원하는 이름)
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: 200명 강의용이면 **Starter ($7/월)** 권장 (무료 플랜은 슬립·성능 제한 있음)
6. **Create Web Service** 클릭

배포 완료 후 `https://livepoll-xxxx.onrender.com` URL이 생성됩니다.

### 3. 사용

- 호스트: `https://your-url.onrender.com/host.html`
- 참가: QR 코드 또는 `https://your-url.onrender.com/join.html?code=XXXXXX`

## 주의사항

- 서버 재시작 시 진행 중인 세션이 초기화됩니다.
- 호스트 브라우저를 닫으면 세션이 종료될 수 있습니다.
