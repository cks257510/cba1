export { BattleRoom } from './BattleRoom.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/') {
      return new Response('캐릭터 난투 Battle Worker OK', { status: 200 });
    }

    if (url.pathname.startsWith('/battle/')) {
      const roomId = decodeURIComponent(url.pathname.split('/').filter(Boolean)[1] || 'default');
      const id = env.BATTLE_ROOM.idFromName(roomId);
      const stub = env.BATTLE_ROOM.get(id);
      return stub.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};
