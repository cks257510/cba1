# 캐릭터 난투 배포 가이드

## 1. GitHub Pages 배포

1. zip 압축을 풉니다.
2. 압축을 푼 폴더 안의 파일 전체를 GitHub 저장소 루트에 업로드합니다.
   - `index.html`
   - `styles.css`
   - `src/`
   - `assets/`
   - `manifest.json`
   - `service-worker.js`
3. GitHub 저장소 → Settings → Pages
4. Source: Deploy from a branch
5. Branch: main
6. Folder: /root
7. Save
8. 몇 분 후 표시되는 Pages 주소로 접속합니다.

예상 주소:
```text
https://깃허브아이디.github.io/저장소이름/
```

## 2. Firebase Authorized domains 추가

GitHub Pages 주소에서 Firebase Auth 로그인/회원가입을 하려면 Firebase Auth 허용 도메인에 GitHub Pages 도메인을 추가해야 합니다.

1. Firebase Console 접속
2. Authentication
3. Settings
4. Authorized domains
5. Add domain
6. 아래 형식으로 입력

```text
깃허브아이디.github.io
```

## 3. Firebase Realtime Database Rules

`firebase-rules.example.json` 파일 내용을 Firebase Realtime Database Rules에 붙여넣습니다.

## 4. Cloudflare Worker 배포

전투 서버를 실제로 연결할 때만 진행합니다.

```bash
cd cloudflare-worker
npm install
npx wrangler login
npx wrangler deploy
```

배포 후 나온 Worker 주소를 `src/config.js`에 넣습니다.

```js
workerUrl: "https://character-pvp-battle-worker.계정명.workers.dev"
```

## 5. 캐시 초기화

새 버전을 올렸는데 예전 화면이 계속 나오면:

```text
/clear_cache.html
```

로 접속해서 캐시 초기화 후 Ctrl+F5 새로고침합니다.
