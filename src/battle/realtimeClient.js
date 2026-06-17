import { APP_CONFIG } from '../config.js';

export const createRealtimeBattleClient = ({ roomId, playerId, token, onSnapshot, onEvent, onOpen, onClose, onError }) => {
  if (!APP_CONFIG.workerUrl) {
    throw new Error('Cloudflare Worker URL이 아직 설정되지 않았습니다. src/config.js의 workerUrl을 입력하세요.');
  }

  const base = APP_CONFIG.workerUrl.replace(/^http/, 'ws').replace(/\/$/, '');
  const socket = new WebSocket(`${base}/battle/${encodeURIComponent(roomId)}?playerId=${encodeURIComponent(playerId)}&token=${encodeURIComponent(token || '')}`);

  socket.addEventListener('open', () => {
    onOpen?.();
    socket.send(JSON.stringify({ type: 'join', roomId, playerId }));
  });

  socket.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'snapshot') onSnapshot?.(data);
      else onEvent?.(data);
    } catch (error) {
      console.error('battle message parse error', error);
    }
  });

  socket.addEventListener('close', onClose || (() => {}));
  socket.addEventListener('error', onError || (() => {}));

  return {
    sendInput(input) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'input', input, clientTime: Date.now() }));
      }
    },
    start(mode, config = {}) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'start', mode, config }));
      }
    },
    close() {
      socket.close();
    },
  };
};
