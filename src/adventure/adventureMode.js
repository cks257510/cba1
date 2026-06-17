
import { getFirebaseDb } from '../services/firebaseService.js';
import { PUBLIC_PATHS } from '../config.js';
import { CHARACTER_MAP, CHARACTER_LIST } from '../data/characters.js';
import { ref, set, onValue, off, remove } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);
const rand = (a,b) => a + Math.random() * (b-a);
const norm = (x,y) => {
  const d = Math.hypot(x,y) || 1;
  return { x:x/d, y:y/d };
};

const WORLD = { w: 4203, h: 2346 };
const RESPAWN_MS = 5 * 60 * 1000;

const RECIPES = {
  wooden_spear: { name:'나무창', type:'weapon', cost:{ wood:14 }, atk:6, effect:'공격력 +6' },
  stone_sword: { name:'돌검', type:'weapon', cost:{ wood:2, stone:8 }, atk:10, effect:'공격력 +10' },
  iron_sword: { name:'철검', type:'weapon', cost:{ wood:2, iron:8 }, atk:24, effect:'공격력 +24' },
  bow: { name:'활', type:'weapon', cost:{ wood:16, stone:4 }, atk:14, effect:'공격력 +14' },
  stone_armor: { name:'돌갑옷', type:'armor', cost:{ stone:14 }, hp:90, effect:'체력 +90' },
  iron_armor: { name:'철갑옷', type:'armor', cost:{ iron:14 }, hp:210, effect:'체력 +210' },
  bandage: { name:'붕대', type:'item', cost:{ wood:4 }, effect:'체력 회복 아이템' },
  wall: { name:'벽', type:'building', cost:{ wood:6, stone:4 }, effect:'현재 위치에 벽 설치' },
  door: { name:'문', type:'building', cost:{ wood:8, iron:2 }, effect:'현재 위치에 문 설치' },
  house: { name:'백성 집', type:'building', cost:{ wood:35, stone:12 }, effect:'주민과 기사 증가' },
  car: { name:'자동차', type:'vehicle', cost:{ wood:18, iron:42 }, effect:'육지 이동속도 증가' },
  boat: { name:'보트', type:'vehicle', cost:{ wood:28, iron:24 }, effect:'물 위 이동 가능' },
  castle_set: { name:'성 세트', type:'building', cost:{ wood:70, stone:70, iron:18 }, effect:'벽과 문으로 작은 성 설치' },
};

const canPay = (bag, cost) => Object.entries(cost).every(([k,v]) => (bag[k]||0) >= v);
const pay = (bag, cost) => Object.entries(cost).forEach(([k,v]) => { bag[k] = (bag[k]||0) - v; });

const makeResources = () => {
  const arr = [];
  const types = [
    ['tree', 150, '#2f8f45'],
    ['stone', 105, '#9ca3af'],
    ['iron', 70, '#b7793f'],
  ];
  let id = 0;
  for (const [type, count, color] of types) {
    for (let i=0;i<count;i++) {
      arr.push({ id:`res_${id++}`, type, color, x:rand(70,WORLD.w-70), y:rand(70,WORLD.h-70), alive:true, respawnAt:0, radius:type==='tree'?13:11 });
    }
  }
  return arr;
};

const makeNpcs = () => {
  const list = [];
  const add = (nation, role, count, x, y) => {
    for (let i=0;i<count;i++) {
      const stats = role === 'king' ? [350,22,13,24] : role === 'guard' ? [230,18,12,20] : role === 'knight' ? [150,13,13,18] : role === 'bandit' ? [110,11,15,17] : [80,5,11,15];
      list.push({ id:`npc_${nation}_${role}_${i}_${Date.now()}`, nation, role, x:x+rand(-100,100), y:y+rand(-100,100), hp:stats[0], maxHp:stats[0], atk:stats[1], speed:stats[2], radius:stats[3], bornAt:Date.now(), lifeMs: role==='king'?99999999: rand(220000,420000), target:null });
    }
  };
  add('demacia','king',1,630,1470);
  add('demacia','guard',3,630,1470);
  add('demacia','knight',8,780,1560);
  add('demacia','villager',10,690,1680);
  add('noxus','king',1,3690,1620);
  add('noxus','guard',4,3690,1620);
  add('noxus','knight',10,3540,1530);
  add('noxus','villager',12,3420,1440);
  add('bandit','bandit',12,2220,1140);
  return list;
};

const roleKo = (role) => ({
  king:'왕', guard:'호위무사', knight:'기사', villager:'주민', bandit:'산적'
}[role] || role);


const makeStructure = ({ id, type, nation = 'demacia', x, y, w, h, ownerId = '', ownerOnline = true, hp = 10 }) => ({
  id, type, nation, x, y, w, h, hp, maxHp: hp, ownerId, ownerOnline,
});

const makeCastlePieces = (prefix, nation, x, y, ownerId = '') => {
  const pieces = [];
  const W = 360, H = 260, thick = 26;
  pieces.push(makeStructure({ id:`${prefix}_top`, type:'wall', nation, x, y:y-H/2, w:W, h:thick, ownerId, hp:10 }));
  pieces.push(makeStructure({ id:`${prefix}_bottom_l`, type:'wall', nation, x:x-W*.28, y:y+H/2, w:W*.44, h:thick, ownerId, hp:10 }));
  pieces.push(makeStructure({ id:`${prefix}_bottom_r`, type:'wall', nation, x:x+W*.28, y:y+H/2, w:W*.44, h:thick, ownerId, hp:10 }));
  pieces.push(makeStructure({ id:`${prefix}_gate`, type:'door', nation, x, y:y+H/2, w:70, h:thick+12, ownerId, hp:10 }));
  pieces.push(makeStructure({ id:`${prefix}_left`, type:'wall', nation, x:x-W/2, y, w:thick, h:H, ownerId, hp:10 }));
  pieces.push(makeStructure({ id:`${prefix}_right`, type:'wall', nation, x:x+W/2, y, w:thick, h:H, ownerId, hp:10 }));
  return pieces;
};

export const mountAdventureMode = ({ root = document, player, user, onExit, onToast }) => {
  const canvas = root.getElementById('adventure-canvas');
  const panel = root.getElementById('adventure-panel');
  const invPanel = root.getElementById('adventure-inventory');
  const nationEl = root.getElementById('adventure-country-state');
  const joy = root.getElementById('adventure-joystick');
  const knob = root.getElementById('adventure-joystick-knob');
  if (!canvas) return () => {};
  const ctx = canvas.getContext('2d');
  const db = getFirebaseDb();
  const playerId = player?.id || `guest_${Date.now()}`;
  const onlineRef = db && user ? ref(db, `${PUBLIC_PATHS.adventure || 'adventureWorld'}/players/${playerId}`) : null;
  const playersRef = db ? ref(db, `${PUBLIC_PATHS.adventure || 'adventureWorld'}/players`) : null;

  const activeChar = player?.activeCharacter || CHARACTER_MAP[player?.activeCharacterId] || CHARACTER_LIST[0];
  const activeImg = new Image();
  activeImg.src = activeChar?.image || '';
  const img = new Image();
  img.src = 'assets/adventure/amap.png';
  img.onload = () => {
    if (img.naturalWidth && img.naturalHeight) {
      WORLD.w = img.naturalWidth * 3;
      WORLD.h = img.naturalHeight * 3;
      resize();
    }
  };

  let running = true;
  let raf = 0;
  let last = performance.now();
  const keys = {};
  const joyInput = { x:0, y:0 };
  let joyActive = false;
  let runUntil = 0;
  let runCooldownUntil = 0;

  const me = {
    id: playerId,
    nickname: player?.nickname || '플레이어',
    characterName: activeChar?.name || '캐릭터',
    image: activeChar?.image || '',
    x: 630, y: 1470,
    hp: 260, maxHp: 260,
    baseAtk: 12, atk: 12, baseSpeed: 120, speed: 120,
    radius: 24,
    nation: 'demacia',
    bag: { wood: 25, stone: 12, iron: 3, berry: 2, bandage: 1 },
    inventory: [],
    droppedItems: [],
    weapon: { name:'맨손', atk:0 },
    armor: { name:'천옷', hp:0 },
    vehicle: null,
    dirX: 1,
    dirY: 0,
  };
  let others = {};
  const resources = makeResources();
  const npcs = makeNpcs();
  const groundItems = [
    { id:'g_berry_1', type:'berry', name:'열매', x:1020, y:1590, count:3, radius:10 },
    { id:'g_meat_1', type:'meat', name:'고기', x:2220, y:1170, count:2, radius:10 },
    { id:'g_bandage_1', type:'bandage', name:'붕대', x:780, y:1410, count:1, radius:10 },
  ];
  const buildings = [
    ...makeCastlePieces('castle_demacia', 'demacia', 630, 1470),
    ...makeCastlePieces('castle_noxus', 'noxus', 3690, 1620),
  ];
  // 물 범위 확대 + 중앙 통로 1개. 원본 맵 전체를 3배 스케일로 사용합니다.
  const waterRects = [
    { x: 1160, y: 0, w: 230, h: 900 },
    { x: 1120, y: 960, w: 235, h: 1330 },
    { x: 1840, y: 0, w: 180, h: 690 },
    { x: 1670, y: 620, w: 1040, h: 170 },
    { x: 1380, y: 1070, w: 1110, h: 145 },
  ];
  const passageRects = [
    { x: 1060, y: 870, w: 390, h: 105 }, // 데마시아 ↔ 녹서스 이동 통로
  ];
  const boats = [{x:1410,y:1222,r:46},{x:2700,y:1920,r:46}];

  const resize = () => {
    const rect = canvas.parentElement?.getBoundingClientRect() || {width:innerWidth,height:innerHeight};
    canvas.width = Math.max(320, Math.floor(rect.width * devicePixelRatio));
    canvas.height = Math.max(320, Math.floor(rect.height * devicePixelRatio));
    ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
  };
  resize();
  addEventListener('resize', resize, { passive:true });

  const inRect = (x, y, r) => x>=r.x && x<=r.x+r.w && y>=r.y && y<=r.y+r.h;
  const isPassage = (x,y) => passageRects.some(r => inRect(x,y,r));
  const isWater = (x,y) => !isPassage(x,y) && waterRects.some(r => inRect(x,y,r));
  const nearBoat = () => boats.some(b => Math.hypot(me.x-b.x, me.y-b.y) < 70);
  const canMoveTo = (x,y) => (!isWater(x,y) || nearBoat() || me.vehicle?.type === 'boat') && !buildings.some(b => (b.type==='wall' || b.type==='door') && x>b.x-b.w/2-me.radius && x<b.x+b.w/2+me.radius && y>b.y-b.h/2-me.radius && y<b.y+b.h/2+me.radius);

  const publish = () => {
    if (!onlineRef) return;
    set(onlineRef, {
      id:playerId,
      nickname:me.nickname,
      characterName:me.characterName,
      image:me.image,
      x:Math.round(me.x),
      y:Math.round(me.y),
      hp:Math.round(me.hp),
      maxHp:me.maxHp,
      nation:me.nation,
      radius:me.radius,
      at:Date.now()
    }).catch(()=>{});
  };
  let publishTimer = setInterval(publish, 130);
  let unsub = null;
  if (playersRef) {
    const handler = onValue(playersRef, (snap) => {
      others = snap.exists() ? snap.val() : {};
      delete others[playerId];
    });
    unsub = () => off(playersRef, 'value', handler);
  }

  const toast = (msg) => onToast ? onToast(msg, 'info') : null;
  const addItem = (type, name, count=1) => {
    const old = me.inventory.find(i => i.type===type && i.name===name);
    if (old) old.count += count;
    else me.inventory.push({ type, name, count });
  };
  const removeItem = (type, count=1) => {
    const it = me.inventory.find(i => i.type===type);
    if (!it || it.count < count) return false;
    it.count -= count;
    if (it.count <= 0) me.inventory = me.inventory.filter(x => x !== it);
    return true;
  };
  const dropGround = (type, name, count=1) => {
    groundItems.push({ id:`drop_${Date.now()}_${Math.random()}`, type, name, count, x:me.x+rand(-20,20), y:me.y+rand(-20,20), radius:10 });
  };
  const updateNation = () => {
    if (!nationEl) return;
    const demacia = npcs.filter(n => n.nation==='demacia').length;
    const noxus = npcs.filter(n => n.nation==='noxus').length;
    const bandits = npcs.filter(n => n.nation==='bandit').length;
    const housesD = buildings.filter(b => b.type==='house' && b.nation==='demacia').length;
    const housesN = buildings.filter(b => b.type==='house' && b.nation==='noxus').length;
    nationEl.textContent = `데마시아 ${demacia}명 · 집 ${housesD} | 녹서스 ${noxus}명 · 집 ${housesN} | 산적 ${bandits}`;
  };
  const updatePanel = () => {
    if (panel) panel.innerHTML = `
      <b>${me.nickname}</b> · ${me.characterName}<br>
      HP ${Math.round(me.hp)}/${me.maxHp} · 공격 ${me.atk}<br>
      나무 ${me.bag.wood||0} · 돌 ${me.bag.stone||0} · 철 ${me.bag.iron||0}<br>
      열매 ${me.bag.berry||0} · 고기 ${me.bag.meat||0} · 붕대 ${me.bag.bandage||0}<br>
      무기 ${me.weapon.name} · 갑옷 ${me.armor.name} · 탑승 ${me.vehicle?.name || '없음'}<br>
      <small>조이패드 이동 · 달리기 3초 / 쿨 5초</small>
    `;
    if (invPanel) {
      const inv = me.inventory.length ? me.inventory.map(i => `<div>${i.name} x${i.count}</div>`).join('') : '<div>가방 아이템 없음</div>';
      invPanel.innerHTML = `
        <b>인벤토리</b>
        ${inv}
        <div class="adventure-mini-actions">
          <button data-adventure-inv="drop-wood">나무 놓기</button>
          <button data-adventure-inv="drop-stone">돌 놓기</button>
          <button data-adventure-inv="drop-iron">철 놓기</button>
          <button data-adventure-inv="drop-weapon">무기 버리기</button>
          <button data-adventure-inv="drop-armor">갑옷 버리기</button>
          <button data-adventure-inv="eat">음식 사용</button>
        </div>
      `;
    }
    updateNation();
    const runBtn = root.querySelector('[data-adventure-action="run"]');
    if (runBtn) {
      const now = performance.now();
      const cd = Math.max(0, Math.ceil((runCooldownUntil - now)/1000));
      const active = now < runUntil;
      runBtn.innerHTML = active ? '달리는 중' : cd ? `달리기 ${cd}초` : '달리기';
      runBtn.classList.toggle('ready', !cd && !active);
    }
  };

  const gather = (kind) => {
    const usable = resources.find(r => r.alive && Math.hypot(me.x-r.x, me.y-r.y) < 70 && (kind==='chop' ? r.type==='tree' : r.type!=='tree'));
    if (!usable) return toast(kind==='chop' ? '가까운 나무가 없습니다.' : '가까운 암석/철광석이 없습니다.');
    usable.alive = false;
    usable.respawnAt = Date.now() + RESPAWN_MS;
    if (usable.type==='tree') me.bag.wood = (me.bag.wood||0) + 4;
    if (usable.type==='stone') me.bag.stone = (me.bag.stone||0) + 3;
    if (usable.type==='iron') me.bag.iron = (me.bag.iron||0) + 2;
    toast(`${usable.type==='tree'?'나무':usable.type==='stone'?'돌':'철'} 획득`);
    updatePanel();
  };
  const frontPosition = (distance = 78) => ({
    x: clamp(me.x + (me.dirX || 1) * distance, 30, WORLD.w - 30),
    y: clamp(me.y + (me.dirY || 0) * distance, 30, WORLD.h - 30),
  });

  const craftById = (id) => {
    const r = RECIPES[id];
    if (!r) return false;
    if (!canPay(me.bag, r.cost)) { toast('재료가 부족합니다.'); return false; }
    pay(me.bag, r.cost);
    if (r.type==='weapon') {
      me.weapon = { name:r.name, atk:r.atk||0 };
      me.atk = me.baseAtk + me.weapon.atk;
    } else if (r.type==='armor') {
      me.armor = { name:r.name, hp:r.hp||0 };
      me.maxHp = 260 + me.armor.hp;
      me.hp = me.maxHp;
    } else if (r.type==='vehicle') {
      me.vehicle = { name:r.name, type:id };
    } else if (id==='bandage') {
      me.bag.bandage = (me.bag.bandage||0)+1;
    } else if (id==='wall' || id==='door') {
      const p = frontPosition(id==='wall' ? 86 : 78);
      buildings.push(makeStructure({
        id:`b_${Date.now()}`,
        type:id==='wall'?'wall':'door',
        nation:'demacia',
        x:p.x,
        y:p.y,
        w:id==='wall'?96:76,
        h:id==='wall'?28:24,
        ownerId:playerId,
        ownerOnline:true,
        hp:10,
      }));
    } else if (id==='castle_set') {
      const p = frontPosition(170);
      buildings.push(...makeCastlePieces(`castle_player_${Date.now()}`, 'demacia', p.x, p.y, playerId).map((b) => ({ ...b, ownerOnline:true })));
    } else if (id==='house') {
      const p = frontPosition(98);
      buildings.push(makeStructure({ id:`house_${Date.now()}`, type:'house', nation:'demacia', x:p.x, y:p.y, w:90, h:70, ownerId:playerId, ownerOnline:true, hp:14 }));
      npcs.push({ id:`npc_demacia_villager_${Date.now()}`, nation:'demacia', role:'villager', x:p.x+40, y:p.y, hp:80, maxHp:80, atk:5, speed:11, radius:15, bornAt:Date.now(), lifeMs:320000 });
      npcs.push({ id:`npc_demacia_knight_${Date.now()}`, nation:'demacia', role:'knight', x:p.x-40, y:p.y, hp:150, maxHp:150, atk:13, speed:13, radius:18, bornAt:Date.now(), lifeMs:360000 });
    }
    toast(`${r.name} 제작 완료`);
    updatePanel();
    return true;
  };
  const craft = () => {
    const menu = Object.entries(RECIPES).map(([id,r]) => {
      const cost = Object.entries(r.cost).map(([k,v])=>`${k}:${v}`).join(' ');
      return `${id} = ${r.name} (${cost}) / ${r.effect}`;
    }).join('\n');
    const id = prompt(`제작 ID를 입력하세요:\n${menu}\n예: stone_sword, iron_armor, wall, door, castle_set, car, boat`);
    if (!id) return;
    craftById(id.trim());
  };
  const canDamageBuilding = (b) => !b.ownerId || b.ownerId === playerId || b.ownerOnline;
  const damageBuilding = (b, amount = 1) => {
    if (!canDamageBuilding(b)) return false;
    b.hp = (b.hp ?? 10) - amount;
    toast(`${b.type === 'door' ? '문' : b.type === 'wall' ? '벽' : '구조물'} 내구도 ${Math.max(0, b.hp)}/${b.maxHp || 10}`);
    if (b.hp <= 0) {
      const idx = buildings.indexOf(b);
      if (idx >= 0) buildings.splice(idx, 1);
      toast('구조물이 부서졌습니다.');
    }
    return true;
  };

  const attack = () => {
    const target = npcs.find(n => n.nation !== 'demacia' && dist(me,n)<me.radius+n.radius+42);
    if (target) {
      target.hp -= me.atk;
      if (target.hp <= 0) {
        if (target.role==='knight' || target.role==='guard') me.bag.iron = (me.bag.iron||0)+3;
        if (target.role==='bandit') me.bag.meat = (me.bag.meat||0)+1;
        target.dead = true;
        toast(`${roleKo(target.role)} 처치`);
      }
      updatePanel();
      return;
    }

    const bx = me.x + (me.dirX || 1) * 45;
    const by = me.y + (me.dirY || 0) * 45;
    const building = buildings.find((b) =>
      b.nation !== 'demacia'
      && (b.type === 'wall' || b.type === 'door' || b.type === 'house')
      && bx > b.x - b.w/2 - 34 && bx < b.x + b.w/2 + 34
      && by > b.y - b.h/2 - 34 && by < b.y + b.h/2 + 34
    );
    if (building && damageBuilding(building, 1)) {
      updatePanel();
      return;
    }
    toast('공격할 대상이 없습니다.');
  };
  const buildQuick = (type) => {
    const id = type==='build-wall'?'wall':type==='build-door'?'door':'house';
    craftById(id);
  };
  const run = () => {
    const now = performance.now();
    if (now < runCooldownUntil) return toast(`달리기 쿨타임 ${Math.ceil((runCooldownUntil-now)/1000)}초`);
    runUntil = now + 3000;
    runCooldownUntil = now + 5000;
    toast('3초 동안 이동속도 증가');
    updatePanel();
  };
  const pickupGround = () => {
    for (let i=groundItems.length-1;i>=0;i--) {
      const g = groundItems[i];
      if (Math.hypot(me.x-g.x,me.y-g.y) < 50) {
        if (['wood','stone','iron','berry','meat','bandage'].includes(g.type)) me.bag[g.type]=(me.bag[g.type]||0)+g.count;
        else addItem(g.type,g.name,g.count);
        toast(`${g.name} 획득`);
        groundItems.splice(i,1);
        updatePanel();
        return;
      }
    }
    toast('주울 아이템이 없습니다.');
  };
  const invAction = (a) => {
    if (a==='drop-wood' && (me.bag.wood||0)>0) { me.bag.wood--; dropGround('wood','나무'); }
    else if (a==='drop-stone' && (me.bag.stone||0)>0) { me.bag.stone--; dropGround('stone','돌'); }
    else if (a==='drop-iron' && (me.bag.iron||0)>0) { me.bag.iron--; dropGround('iron','철'); }
    else if (a==='drop-weapon' && me.weapon.name!=='맨손') { dropGround('weapon',me.weapon.name); me.weapon={name:'맨손',atk:0}; me.atk=me.baseAtk; }
    else if (a==='drop-armor' && me.armor.name!=='천옷') { dropGround('armor',me.armor.name); me.armor={name:'천옷',hp:0}; me.maxHp=260; me.hp=Math.min(me.hp,me.maxHp); }
    else if (a==='eat') {
      if ((me.bag.bandage||0)>0) { me.bag.bandage--; me.hp=clamp(me.hp+80,0,me.maxHp); }
      else if ((me.bag.meat||0)>0) { me.bag.meat--; me.hp=clamp(me.hp+55,0,me.maxHp); }
      else if ((me.bag.berry||0)>0) { me.bag.berry--; me.hp=clamp(me.hp+25,0,me.maxHp); }
      else toast('사용할 음식/붕대가 없습니다.');
    } else toast('버릴 수 있는 아이템이 없습니다.');
    updatePanel();
  };

  const action = (a) => {
    if (a==='chop' || a==='mine') gather(a);
    if (a==='attack') attack();
    if (a==='craft') craft();
    if (a==='run') run();
    if (a==='pickup') pickupGround();
    if (a==='build-wall' || a==='build-door' || a==='build-house') buildQuick(a);
    if (a==='craft-car') craftById('car');
    if (a==='craft-boat') craftById('boat');
    if (a==='build-castle') craftById('castle_set');
  };
  root.querySelectorAll('[data-adventure-action]').forEach(btn => btn.addEventListener('click', () => action(btn.dataset.adventureAction)));
  invPanel?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-adventure-inv]');
    if (btn) invAction(btn.dataset.adventureInv);
  });

  const setJoy = (e) => {
    if (!joy || !knob) return;
    const rect = joy.getBoundingClientRect();
    const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
    const dx = e.clientX - cx, dy = e.clientY - cy;
    const max = rect.width * .34;
    const len = Math.min(max, Math.hypot(dx,dy));
    const n = norm(dx,dy);
    joyInput.x = n.x * (len/max);
    joyInput.y = n.y * (len/max);
    knob.style.transform = `translate(${n.x*len}px, ${n.y*len}px)`;
  };
  const resetJoy = () => { joyInput.x=0; joyInput.y=0; if (knob) knob.style.transform='translate(0,0)'; };
  joy?.addEventListener('pointerdown', (e)=>{ e.preventDefault(); joyActive=true; try{joy.setPointerCapture(e.pointerId)}catch{}; setJoy(e); }, { passive:false });
  window.addEventListener('pointermove', (e)=>{ if(joyActive){ e.preventDefault(); setJoy(e); } }, { passive:false });
  window.addEventListener('pointerup', ()=>{ joyActive=false; resetJoy(); }, { passive:true });
  window.addEventListener('pointercancel', ()=>{ joyActive=false; resetJoy(); }, { passive:true });

  const keyDown = e => {
    keys[e.code]=true;
    if (e.code==='Escape') onExit?.();
    if (e.code==='KeyE') gather('chop');
    if (e.code==='KeyR') gather('mine');
    if (e.code==='Space') attack();
    if (e.code==='KeyC') craft();
    if (e.code==='KeyF') pickupGround();
    if (e.code==='ShiftLeft' || e.code==='ShiftRight') run();
  };
  const keyUp = e => { keys[e.code]=false; };
  addEventListener('keydown', keyDown); addEventListener('keyup', keyUp);

  const npcStep = (dt) => {
    resources.forEach(r => { if (!r.alive && Date.now() >= r.respawnAt) r.alive = true; });
    for (let i=npcs.length-1;i>=0;i--) {
      const n = npcs[i];
      if (n.dead || Date.now()-n.bornAt > n.lifeMs) { npcs.splice(i,1); continue; }
      let tx = n.x, ty = n.y;
      if (n.role==='guard') {
        const king = npcs.find(k=>k.nation===n.nation && k.role==='king');
        if (king) { tx=king.x+rand(-70,70); ty=king.y+rand(-70,70); }
      } else if (n.nation==='noxus' || n.nation==='bandit') {
        if (dist(n,me)<430) { tx=me.x; ty=me.y; }
        else { tx=n.x+rand(-80,80); ty=n.y+rand(-80,80); }
      } else {
        tx=n.x+rand(-40,40); ty=n.y+rand(-40,40);
      }
      const dx=tx-n.x, dy=ty-n.y, l=Math.hypot(dx,dy)||1;
      n.x=clamp(n.x+dx/l*n.speed*dt,20,WORLD.w-20);
      n.y=clamp(n.y+dy/l*n.speed*dt,20,WORLD.h-20);
      if ((n.nation==='noxus'||n.nation==='bandit') && dist(n,me)<me.radius+n.radius+6) me.hp = Math.max(0, me.hp - n.atk*dt);
      if (n.nation==='noxus' || n.nation==='bandit') {
        const closeStructure = buildings.find((b) => b.nation === 'demacia' && (b.type==='wall' || b.type==='door') && canDamageBuilding(b) && Math.abs(n.x-b.x) < b.w/2+n.radius+12 && Math.abs(n.y-b.y) < b.h/2+n.radius+12);
        if (closeStructure && Math.random() < 0.02) damageBuilding(closeStructure, 1);
      }
    }
    if (Math.random()<0.0008) buildings.push({ id:`nox_house_${Date.now()}`, type:'house', nation:'noxus', x:rand(3150,3900), y:rand(1320,1860), w:90, h:70 });
  };

  const draw = () => {
    const vw = canvas.width / devicePixelRatio;
    const vh = canvas.height / devicePixelRatio;
    const camX = clamp(me.x - vw/2, 0, Math.max(1, WORLD.w-vw));
    const camY = clamp(me.y - vh/2, 0, Math.max(1, WORLD.h-vh));
    ctx.clearRect(0,0,vw,vh);
    if (img.complete && img.naturalWidth) ctx.drawImage(img, -camX, -camY, WORLD.w, WORLD.h);
    else { ctx.fillStyle='#357a3b'; ctx.fillRect(0,0,vw,vh); }

    const sx = x => x-camX, sy = y => y-camY;
    waterRects.forEach(w => { ctx.fillStyle='rgba(0,190,200,.25)'; ctx.fillRect(sx(w.x),sy(w.y),w.w,w.h); });
    passageRects.forEach(p => { ctx.fillStyle='rgba(150,120,75,.34)'; ctx.fillRect(sx(p.x),sy(p.y),p.w,p.h); });
    boats.forEach(b => { ctx.fillStyle='#8b5a2b'; ctx.beginPath(); ctx.ellipse(sx(b.x),sy(b.y),48,24,0,0,Math.PI*2); ctx.fill(); });
    groundItems.filter(g=>sx(g.x)>-40&&sx(g.x)<vw+40&&sy(g.y)>-40&&sy(g.y)<vh+40).forEach(g=>{
      ctx.fillStyle=g.type==='iron'?'#b7793f':g.type==='stone'?'#9ca3af':g.type==='wood'?'#8b5a2b':g.type==='berry'?'#ef4444':'#f8fafc';
      ctx.beginPath(); ctx.arc(sx(g.x),sy(g.y),g.radius,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#fff'; ctx.font='700 10px sans-serif'; ctx.textAlign='center'; ctx.fillText(g.name, sx(g.x), sy(g.y)-14);
    });
    resources.filter(r=>r.alive && sx(r.x)>-40&&sx(r.x)<vw+40&&sy(r.y)>-40&&sy(r.y)<vh+40).forEach(r=>{
      ctx.fillStyle=r.color; ctx.beginPath(); ctx.arc(sx(r.x),sy(r.y),r.radius,0,Math.PI*2); ctx.fill();
    });
    buildings.forEach(b=>{
      ctx.fillStyle=b.type==='castle'?(b.nation==='demacia'?'#cbd5e1':'#64748b'):b.type==='house'?'#a16207':b.type==='door'?'#854d0e':'#737373';
      ctx.fillRect(sx(b.x-b.w/2),sy(b.y-b.h/2),b.w,b.h);
      ctx.strokeStyle='#111'; ctx.strokeRect(sx(b.x-b.w/2),sy(b.y-b.h/2),b.w,b.h);
      if (b.type==='wall' || b.type==='door') {
        ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fillRect(sx(b.x-b.w/2), sy(b.y-b.h/2)-8, b.w, 4);
        ctx.fillStyle=b.nation==='demacia'?'#22c55e':'#ef4444'; ctx.fillRect(sx(b.x-b.w/2), sy(b.y-b.h/2)-8, b.w*Math.max(0,(b.hp||10)/(b.maxHp||10)), 4);
      }
    });
    const drawActor=(a,color,label,imgSrc='')=>{
      const r = a.radius || 18;
      ctx.save();
      ctx.beginPath(); ctx.arc(sx(a.x),sy(a.y),r,0,Math.PI*2); ctx.fillStyle=color; ctx.fill(); ctx.clip();
      if (imgSrc) {
        if (a === me && activeImg.complete && activeImg.naturalWidth) ctx.drawImage(activeImg,sx(a.x)-r,sy(a.y)-r,r*2,r*2);
      }
      ctx.restore();
      const barW = Math.max(38, r*2.6);
      const nameY = sy(a.y)-r-24, hpY = sy(a.y)-r-16;
      ctx.fillStyle='#fff'; ctx.font='800 11px sans-serif'; ctx.textAlign='center'; ctx.strokeStyle='rgba(0,0,0,.65)'; ctx.lineWidth=3;
      ctx.strokeText(label, sx(a.x), nameY); ctx.fillText(label, sx(a.x), nameY);
      ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fillRect(sx(a.x)-barW/2,hpY,barW,5);
      ctx.fillStyle=a.nation==='noxus'?'#ef4444':a.nation==='bandit'?'#f59e0b':'#16a34a';
      ctx.fillRect(sx(a.x)-barW/2,hpY,barW*Math.max(0,(a.hp||1)/(a.maxHp||1)),5);
    };
    npcs.filter(n=>sx(n.x)>-60&&sx(n.x)<vw+60&&sy(n.y)>-60&&sy(n.y)<vh+60).forEach(n=>drawActor(n,n.nation==='demacia'?'#3b82f6':n.nation==='noxus'?'#ef4444':'#f59e0b', roleKo(n.role)));
    Object.values(others).filter(o=>Date.now()-(o.at||0)<8000 && sx(o.x)>-80&&sx(o.x)<vw+80&&sy(o.y)>-80&&sy(o.y)<vh+80).forEach(o=>drawActor(o,'#22c55e',o.nickname||'P',o.image));
    if (me.vehicle?.type === 'car') { ctx.fillStyle='#111827'; ctx.fillRect(sx(me.x)-34, sy(me.y)+18, 68, 26); ctx.fillStyle='#60a5fa'; ctx.fillRect(sx(me.x)-22, sy(me.y)+12, 44, 16); }
    if (me.vehicle?.type === 'boat') { ctx.fillStyle='#8b5a2b'; ctx.beginPath(); ctx.ellipse(sx(me.x), sy(me.y)+24, 52, 22, 0, 0, Math.PI*2); ctx.fill(); }
    drawActor(me,'#38bdf8',me.nickname,me.image);
  };

  const tick = (t) => {
    if (!running) return;
    const dt = Math.min(0.05,(t-last)/1000); last=t;
    const mx=((keys.ArrowRight||keys.KeyD?1:0)-(keys.ArrowLeft||keys.KeyA?1:0)) + joyInput.x;
    const my=((keys.ArrowDown||keys.KeyS?1:0)-(keys.ArrowUp||keys.KeyW?1:0)) + joyInput.y;
    const l=Math.hypot(mx,my)||1;
    if (Math.hypot(mx,my) > 0.08) { const d = norm(mx,my); me.dirX = d.x; me.dirY = d.y; }
    const runMul = performance.now() < runUntil ? 1.65 : 1;
    const vehicleMul = me.vehicle?.type === 'car' && !isWater(me.x, me.y) ? 2.0 : me.vehicle?.type === 'boat' ? 1.35 : 1;
    const nx=me.x+mx/l*me.speed*runMul*vehicleMul*dt, ny=me.y+my/l*me.speed*runMul*vehicleMul*dt;
    if (canMoveTo(nx,ny)) { me.x=clamp(nx,15,WORLD.w-15); me.y=clamp(ny,15,WORLD.h-15); }
    if (me.hp <= 0) { me.hp = me.maxHp; me.x=630; me.y=1470; toast('쓰러져 성으로 돌아왔습니다.'); }
    npcStep(dt);
    draw();
    updatePanel();
    raf=requestAnimationFrame(tick);
  };
  updatePanel();
  publish();
  raf=requestAnimationFrame(tick);

  return () => {
    running=false;
    cancelAnimationFrame(raf);
    clearInterval(publishTimer);
    if (onlineRef) remove(onlineRef).catch(()=>{});
    if (unsub) unsub();
    removeEventListener('keydown', keyDown); removeEventListener('keyup', keyUp);
    removeEventListener('resize', resize);
  };
};
