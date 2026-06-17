import { CHARACTER_LIST, CHARACTER_MAP, BATTLE_NUMBERS, getTierFromPoints } from '../data/characters.js';
import { ITEM_MAP } from '../data/items.js';
import { updateRoom as updateRoomRemote, watchRoom } from '../services/firebaseService.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const norm = (x, y) => {
  const d = Math.hypot(x, y) || 1;
  return { x: x / d, y: y / d };
};
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const BOSS_CHARACTER_MAP = {
  diablo: {
    id: 'diablo',
    name: '디아블로',
    image: 'assets/boss/diablo.png',
    role: '보스',
    classType: 'raid',
    attackType: 'projectile',
    skill1: { name: '지옥 화염', image: 'assets/boss/diablo.png' },
    ultimate: { name: '헬브레스', image: 'assets/boss/diablo.png' },
    baseStats: { attack: 132, hp: 3600, gauge: 100, speed: 0.9, attackSpeed: 0.85, critChance: 8 },
    battle: { projectileSpeed: 8.4, projectileRange: 920 }
  },
  godzilla: {
    id: 'godzilla',
    name: '고질라',
    image: 'assets/boss/godzilla.png',
    role: '보스',
    classType: 'raid',
    attackType: 'projectile',
    skill1: { name: '원자 브레스', image: 'assets/boss/godzilla.png' },
    ultimate: { name: '핵열광선', image: 'assets/boss/godzilla.png' },
    baseStats: { attack: 136, hp: 3800, gauge: 100, speed: 0.82, attackSpeed: 0.78, critChance: 6 },
    battle: { projectileSpeed: 7.4, projectileRange: 980 }
  }
};
const getChar = (id) => BOSS_CHARACTER_MAP[id] || CHARACTER_MAP[id] || CHARACTER_LIST[0];

const getTierPowerMultiplier = (player = {}, mode = 'control') => {
  const points = mode === 'auto' ? player.stats?.rankedPointsAuto || 0 : player.stats?.rankedPointsControl || 0;
  const tierIndex = Math.min(4, Math.floor(Math.max(0, points) / 50));
  return 1 + tierIndex * 0.11 + Math.min(0.25, Math.max(0, points % 50) / 50 * 0.05);
};

const getEquipmentStats = (player = {}, characterId) => (player.equippedItems?.[characterId] || []).reduce((acc, itemId) => {
  const stats = ITEM_MAP[itemId]?.stats || {};
  acc.hp += stats.hp || 0;
  acc.attack += stats.attack || 0;
  acc.attackSpeed += stats.attackSpeed || 0;
  acc.speed += stats.speed || 0;
  acc.critChance += stats.critChance || 0;
  return acc;
}, { hp: 0, attack: 0, attackSpeed: 0, speed: 0, critChance: 0 });

const createUnit = ({ id, characterId, team, x, y, controlled = false, boss = false, player = null, mode = 'control', ownerPlayerId = '' }) => {
  const character = getChar(characterId);
  const equip = team === 'friend' ? getEquipmentStats(player, characterId) : { hp: 0, attack: 0, attackSpeed: 0, speed: 0, critChance: 0 };
  const aiMul = team === 'enemy' && !boss ? getTierPowerMultiplier(player, mode) : 1;
  const hpBoost = boss ? 3.15 : aiMul;
  const attackBoost = boss ? 1.05 : aiMul;
  const angle = rand(0, Math.PI * 2);
  const modeSpeedMultiplier = (mode === 'auto' || mode === 'dungeon') ? 1.17 : 1;
  const maxHp = Math.round((character.baseStats.hp + equip.hp) * hpBoost);
  return {
    id,
    characterId,
    ownerPlayerId,
    character,
    name: boss ? `${character.name} 보스` : character.name,
    team,
    x,
    y,
    vx: Math.cos(angle) * BATTLE_NUMBERS.autoModeInitialLaunchSpeed * modeSpeedMultiplier,
    vy: Math.sin(angle) * BATTLE_NUMBERS.autoModeInitialLaunchSpeed * modeSpeedMultiplier,
    radius: boss ? 48 : BATTLE_NUMBERS.baseCharacterRadius,
    hp: maxHp,
    maxHp,
    attack: Math.max(1, Math.round((((character.baseStats.attack + equip.attack) * attackBoost) / 1.75) * 1.25)),
    attackSpeed: Math.max(0.4, character.baseStats.attackSpeed + equip.attackSpeed),
    speed: Math.max(1.7, character.baseStats.speed + equip.speed) * modeSpeedMultiplier,
    critChance: Math.max(0, character.baseStats.critChance + equip.critChance),
    level: 1,
    skillGauge: 0,
    ultimateGauge: 0,
    lastAttackAt: 0,
    lastShotAt: 0,
    lastSkillAt: 0,
    lastBlinkAt: 0,
    lastGhostAt: 0,
    lastRemoteSkillSeq: 0,
    lastRemoteBlinkSeq: 0,
    lastRemoteGhostSeq: 0,
    lastUltimateAt: 0,
    lastContactBounceAt: 0,
    controlled,
    boss,
    alive: true,
    kills: 0,
    deaths: 0,
    damage: 0,
    damageTaken: 0,
    healing: 0,
    itemBuffUntil: 0,
    speedBuff: 1,
    invulnerableUntil: 0,
    reverseControlUntil: 0,
    slowUntil: 0,
    customEffects: (team === 'friend' ? (((player?.equippedItems?.[characterId] || []).map((id) => player?.customItems?.[id]).filter(Boolean).flatMap((item) => item.effects || []))) : []),
    bossSkillAt: 0,
    weapon: null,
    weaponCharges: 0,
    crabUntil: 0,
  };
};

const teamPower = (player = {}) => {
  const ids = [player.activeCharacterId, ...((player.autoSquad || []).slice(0, 2))].filter(Boolean);
  return ids.reduce((sum, id) => {
    const c = getChar(id);
    const e = getEquipmentStats(player, id);
    return sum + (c.baseStats.hp + e.hp) * 0.11 + (c.baseStats.attack + e.attack) * 2.1 + (c.baseStats.speed + e.speed) * 42 + (c.baseStats.attackSpeed + e.attackSpeed) * 70 + (c.baseStats.critChance + e.critChance) * 8;
  }, 0);
};


const tierIndexForMode = (player = {}, mode = 'control') => {
  const points = mode === 'auto' ? player?.stats?.rankedPointsAuto || 0 : player?.stats?.rankedPointsControl || 0;
  return clamp(Math.floor(Math.max(0, points) / 50), 0, 4);
};

const applyAiBoost = (unit, tierIndex = 0) => {
  const hpMul = 1 + tierIndex * 0.13;
  const atkMul = 1 + tierIndex * 0.08;
  unit.maxHp = Math.round(unit.maxHp * hpMul);
  unit.hp = unit.maxHp;
  unit.attack = Math.round(unit.attack * atkMul);
  return unit;
};



const buildBattleUnits = ({ mode, player, room = null, user = null }) => {
  const ownedIds = Object.keys(player?.ownedCharacters || {});
  const active = player?.activeCharacterId || ownedIds[0] || CHARACTER_LIST[0].id;
  const autoSquad = (player?.autoSquad || []).filter(Boolean);
  const second = autoSquad.find((id) => id !== active) || ownedIds.find((id) => id !== active) || active;
  const enemies = CHARACTER_LIST.filter((c) => ![active, second].includes(c.id)).sort(() => Math.random() - 0.5);

  if (mode === 'friendly' && room) {
    const isHost = room.hostPlayerId === player?.id;
    const myPlayerId = player?.id || '';
    const enemyPlayerId = isHost ? room.guestPlayerId : room.hostPlayerId;
    const myChar = isHost ? (room.hostCharacterId || active) : (room.guestCharacterId || active);
    const enemyChar = isHost ? (room.guestCharacterId || enemies[0]?.id || 'zed') : (room.hostCharacterId || enemies[0]?.id || 'zed');
    return [
      createUnit({ id: 'f1', characterId: myChar, ownerPlayerId: myPlayerId, team: 'friend', x: 150, y: 320, controlled: true, player, mode }),
      createUnit({ id: 'e1', characterId: enemyChar, ownerPlayerId: enemyPlayerId || 'enemy', team: 'enemy', x: 810, y: 320, controlled: false, player, mode }),
    ];
  }

  if (mode === 'raidCoop' && room) {
    const isHost = room.hostPlayerId === player?.id;
    const myPlayerId = player?.id || '';
    const allyPlayerId = isHost ? room.guestPlayerId : room.hostPlayerId;
    const myChar = isHost ? (room.hostCharacterId || active) : (room.guestCharacterId || active);
    const allyChar = isHost ? (room.guestCharacterId || second) : (room.hostCharacterId || second);
    const bossType = room.bossType || 'diablo';
    return [
      createUnit({ id: 'f1', characterId: myChar, ownerPlayerId: myPlayerId, team: 'friend', x: 120, y: 240, controlled: true, player, mode }),
      createUnit({ id: 'f2', characterId: allyChar, ownerPlayerId: allyPlayerId || 'ally', team: 'friend', x: 120, y: 400, controlled: false, player, mode }),
      createUnit({ id: 'boss', characterId: bossType, team: 'enemy', x: 790, y: 320, boss: true, player, mode }),
    ];
  }

  if (mode === 'raidSoloDiablo' || mode === 'raidSoloGodzilla') {
    const bossType = mode === 'raidSoloDiablo' ? 'diablo' : 'godzilla';
    return [
      createUnit({ id: 'f1', characterId: active, team: 'friend', x: 120, y: 240, controlled: true, player, mode }),
      createUnit({ id: 'f2', characterId: second, team: 'friend', x: 120, y: 400, controlled: false, player, mode }),
      createUnit({ id: 'boss', characterId: bossType, team: 'enemy', x: 790, y: 320, boss: true, player, mode }),
    ];
  }

  if (mode === 'dungeon') {
    const bossChar = enemies[0] || CHARACTER_LIST[0];
    const boss = createUnit({ id: 'boss', characterId: bossChar.id, team: 'enemy', x: 535, y: 240, boss: true, player, mode });
    return [
      createUnit({ id: 'f1', characterId: active, team: 'friend', x: 145, y: 245, player, mode }),
      createUnit({ id: 'f2', characterId: second, team: 'friend', x: 145, y: 395, player, mode }),
      boss,
    ];
  }

  if (mode === 'auto') {
    return [
      createUnit({ id: 'f1', characterId: active, team: 'friend', x: 150, y: 245, player, mode }),
      createUnit({ id: 'f2', characterId: second, team: 'friend', x: 150, y: 395, player, mode }),
      createUnit({ id: 'e1', characterId: enemies[0]?.id || 'zed', team: 'enemy', x: 810, y: 245, player, mode }),
      createUnit({ id: 'e2', characterId: enemies[1]?.id || 'ngannou', team: 'enemy', x: 810, y: 395, player, mode }),
    ];
  }

  return [
    createUnit({ id: 'f1', characterId: active, team: 'friend', x: 150, y: 320, controlled: true, player, mode }),
    createUnit({ id: 'e1', characterId: enemies[0]?.id || 'zed', team: 'enemy', x: 810, y: 320, player, mode }),
  ];
};

export const mountLiveBattle = ({ root, mode = 'control', player, room = null, user = null, onExit, onResult }) => {
  const canvas = root.querySelector('#battle-canvas');
  const ctx = canvas.getContext('2d');
  const statusEl = root.querySelector('#battle-status');
  const timerEl = root.querySelector('#battle-timer');
  const logEl = root.querySelector('#battle-log');
  const friendHud = root.querySelector('#friend-hud');
  const enemyHud = root.querySelector('#enemy-hud');
  const resultOverlay = root.querySelector('#battle-result-overlay');
  const resultTitle = root.querySelector('#battle-result-title');
  const resultStats = root.querySelector('#battle-result-stats');

  const W = 960;
  const H = 640;
  canvas.width = W;
  canvas.height = H;

  const units = buildBattleUnits({ mode, player, room, user });
  const projectiles = [];
  const pickups = [];
  const floatingTexts = [];
  const images = new Map();
  const skillImages = new Map();
  const keys = {};
  const input = { x: 0, y: 0, blink: false, skill: false, ghost: false };
  const start = performance.now();
  const countdownMs = 4000;
  const battleStartAt = start + countdownMs;
  let countdownLogged = false;
  let last = performance.now();
  let raf = 0;
  let finished = false;
  let saved = false;
  let lastHud = 0;
  let nextPickupAt = performance.now() + rand(2500, 4500);
  const isFriendly = (mode === 'friendly' || mode === 'raidCoop') && room?.id;
  const isFriendlyHost = isFriendly && room?.hostPlayerId === player?.id;
  const localPlayerId = player?.id || '';
  let latestRoom = room || {};
  let friendlyInputs = {};
  let friendlyBattleState = room?.battleState || null;
  let lastHostStateSyncAt = 0;
  const friendlyInput = { x: 0, y: 0, skillSeq: 0, blinkSeq: 0, ghostSeq: 0, at: Date.now() };
  let lastFriendlySyncAt = 0;
  let unwatchFriendlyRoom = null;

  const syncFriendlyInput = (force = false) => {
    if (!isFriendly || !localPlayerId) return;
    const now = performance.now();
    if (!force && now - lastFriendlySyncAt < 70) return;
    lastFriendlySyncAt = now;
    friendlyInput.x = input.x || 0;
    friendlyInput.y = input.y || 0;
    friendlyInput.at = Date.now();
    updateRoomRemote(room.id, {
      [`battleInputs/${localPlayerId}`]: { ...friendlyInput },
    }).catch(() => {});
  };

  if (isFriendly) {
    unwatchFriendlyRoom = watchRoom(room.id, (nextRoom) => {
      latestRoom = nextRoom || latestRoom || {};
      friendlyInputs = latestRoom.battleInputs || {};
      friendlyBattleState = latestRoom.battleState || friendlyBattleState;
      if (latestRoom?.status === '종료' && latestRoom?.winnerPlayerId && !saved) {
        const elapsed = Math.floor((friendlyBattleState?.elapsed || 0));
        showResult(latestRoom.winnerPlayerId === localPlayerId, elapsed);
      }
    });
  }


  const logs = [];
  const pushLog = (text) => {
    logs.unshift(`[${Math.floor((performance.now() - start) / 1000)}s] ${text}`);
    logs.splice(8);
    if (logEl) logEl.innerHTML = logs.map((line) => `<div class="log-item">${line}</div>`).join('');
  };

  const showSkillName = (u, text, x = u.x, y = u.y) => {
    floatingTexts.push({
      x,
      y: y - u.radius - 18,
      text,
      life: 0.7,
      color: '#ffffff',
    });
  };
  const loadImg = (src, map) => {
    if (!src || map.has(src)) return;
    const img = new Image();
    img.src = src;
    map.set(src, img);
  };
  units.forEach((u) => {
    loadImg(u.character.image, images);
    loadImg(u.character.skill1?.image, skillImages);
    loadImg(u.character.ultimate?.image, skillImages);
  });


  const rankedWinGoldForCurrentPlayer = () => {
    const points = mode === 'auto' ? player?.stats?.rankedPointsAuto || 0 : player?.stats?.rankedPointsControl || 0;
    return points >= 100 ? 80 : 50;
  };

  const alive = (team) => units.filter((u) => u.team === team && u.alive && u.hp > 0);
  const enemiesOf = (u) => units.filter((x) => x.team !== u.team && x.alive && x.hp > 0);
  const closestEnemy = (u) => enemiesOf(u).sort((a, b) => dist(u, a) - dist(u, b))[0];

  const showResult = (win, elapsed) => {
    if (saved) return;
    saved = true;
    if (isFriendlyHost) publishBattleState(elapsed, true);
    const friendUnits = units.filter((u) => u.team === 'friend');
    const allDamage = Math.max(1, units.reduce((s, u) => s + u.damage, 0));
    const maxTaken = Math.max(1, ...units.map((u) => u.damageTaken));
    const result = {
      mode, win,
      kills: friendUnits.reduce((s, u) => s + u.kills, 0),
      damage: friendUnits.reduce((s, u) => s + u.damage, 0),
      survivalTime: Math.floor(elapsed),
      rewardGold: win ? (mode === 'control' || mode === 'auto' ? rankedWinGoldForCurrentPlayer() : mode === 'dungeon' ? 50 : 0) : 0,
    };
    resultTitle.textContent = win ? '승리' : '패배';
    resultStats.innerHTML = `
      <div class="result-compact-summary">
        <div><b>킬</b><strong>${result.kills}</strong></div>
        <div><b>데미지</b><strong>${result.damage}</strong></div>
        <div><b>시간</b><strong>${result.survivalTime}s</strong></div>
        <div><b>보상</b><strong>${result.rewardGold}G</strong></div>
      </div>
      <div class="result-compact-units">
        ${units.map((u) => {
          const dmgPct = Math.round((u.damage / allDamage) * 100);
          return `
            <div class="result-unit-line">
              <span class="${u.team === 'friend' ? 'green' : ''}">${u.team === 'friend' ? '내팀' : '상대'}</span>
              <b>${u.name}</b>
              <em>딜량 ${u.damage}</em>
              <em>받은피해 ${u.damageTaken}</em>
              <em>K/D ${u.kills}/${u.deaths}</em>
            </div>`;
        }).join('')}
      </div>`;
    resultOverlay.classList.add('show');
    resultOverlay.style.pointerEvents = 'auto';
    onResult?.(result);
  };

  const levelScale = (u, elapsed) => {
    const lv = clamp(Math.floor(elapsed / BATTLE_NUMBERS.levelUpEverySeconds) + 1, 1, BATTLE_NUMBERS.maxLevel);
    if (u.level === lv) return;
    const oldMax = u.maxHp;
    const g = lv - 1;
    u.level = lv;
    const bossMul = u.boss ? u.maxHp / Math.max(1, u.character.baseStats.hp) : 1;
    u.maxHp = Math.round(u.character.baseStats.hp * bossMul * (1 + g * 0.03));
    u.attack = Math.max(1, Math.round(((u.character.baseStats.attack * (u.boss ? 1.08 : 1) * (1 + g * 0.025)) / 1.75) * 1.25));
    u.speed = +(u.character.baseStats.speed * (u.boss ? 0.72 : 1) * (1 + g * 0.007)).toFixed(2);
    u.attackSpeed = +(u.character.baseStats.attackSpeed * (1 + g * 0.01)).toFixed(2);
    u.critChance = +(u.character.baseStats.critChance + g * 0.4).toFixed(1);
    u.hp = Math.min(u.maxHp, u.hp + Math.max(0, u.maxHp - oldMax));
  };

  const damage = (attacker, target, amount) => {
    if (!target?.alive || finished) return;
    if (performance.now() < (target.invulnerableUntil || 0)) {
      floatingTexts.push({ x: target.x, y: target.y - 38, text: '무적', life: 0.7, color: '#2ea8ff' });
      return;
    }
    const crit = Math.random() * 100 < attacker.critChance;
    const val = Math.max(1, Math.round(amount * (crit ? 1.6 : 1)));
    target.hp = clamp(target.hp - val, 0, target.maxHp);
    attacker.damage += val;
    target.damageTaken += val;
    if (attacker.customEffects?.includes('slowHit')) target.slowUntil = performance.now() + 1000;
    if (attacker.customEffects?.includes('reverseControl') && Math.random() < 0.18) target.reverseControlUntil = performance.now() + 2000;
    floatingTexts.push({ x: target.x, y: target.y - 38, text: `${crit ? 'CRIT ' : ''}-${val}`, life: 0.8, color: crit ? '#f5a524' : '#101610' });
    if (target.hp <= 0 && target.alive) {
      target.alive = false;
      target.deaths += 1;
      attacker.kills += 1;
      pushLog(`${attacker.name} 처치`);
    }
  };

  const spawnProjectile = (owner, dx, dy, opts = {}) => {
    const n = norm(dx, dy);
    const speedPenalty = opts.isUltimate || owner.character?.ultimate?.name === opts.name ? 0.82 : 1;
    const specialSlow = ['hashirama', 'madara'].includes(owner.character?.id) ? 0.76 : 1;
    const globalProjectileSlow = 1 / 1.75;
    const speed = (opts.speed ?? (owner.character.battle?.projectileSpeed || BATTLE_NUMBERS.projectileBaseSpeed)) * speedPenalty * specialSlow * globalProjectileSlow;
    projectiles.push({
      ownerId: owner.id,
      team: owner.team,
      x: owner.x,
      y: owner.y,
      lastX: owner.x,
      lastY: owner.y,
      vx: n.x * speed,
      vy: n.y * speed,
      radius: (() => {
        const base = opts.radius || BATTLE_NUMBERS.projectileRadius;
        const generalScale = 2 / 1.75;
        const bossScale = owner.boss ? 1.5 : 1;
        const specialScale = ['hashirama', 'madara'].includes(owner.character?.id) ? 1.5 : 1;
        return base * generalScale * bossScale * specialScale;
      })(),
      damage: opts.damage || Math.round(owner.attack * 0.55),
      bouncesLeft: opts.bouncesLeft ?? 2,
      life: opts.life || 3.0,
      traveled: 0,
      range: opts.range || owner.character.battle?.projectileRange || BATTLE_NUMBERS.projectileBaseRange,
      image: opts.image || owner.character.skill1?.image,
      orbitOwnerId: opts.orbitOwnerId || null,
      angle: opts.angle || 0,
      orbitRadius: opts.orbitRadius || 82,
      spinSpeed: opts.spinSpeed || 6,
    });
    loadImg(opts.image || owner.character.skill1?.image, skillImages);
  };

  const shotgun = (owner, target, opts = {}) => {
    const n = norm(target.x - owner.x, target.y - owner.y);
    const baseAngle = Math.atan2(n.y, n.x);
    const count = opts.count || 3;
    const spread = (opts.spreadDeg ?? BATTLE_NUMBERS.rangedShotgunAngleDeg) * Math.PI / 180;
    for (let i = 0; i < count; i++) {
      const offset = count === 1 ? 0 : (i - (count - 1) / 2) * spread;
      spawnProjectile(owner, Math.cos(baseAngle + offset), Math.sin(baseAngle + offset), opts);
    }
  };


  const getSkill1Damage = (u) => Math.round(u.attack * (u.character.attackType === 'projectile' ? 0.92 : 1.05));
  const getUltimateTotalDamage = (u) => Math.round(getSkill1Damage(u) * 1.3 * 1.25);


  const DUOLINGO_WORDS = [
    { word: 'negotiate', answer: '협상하다', wrong: '축하하다' },
    { word: 'revenue', answer: '수익', wrong: '규칙' },
    { word: 'deadline', answer: '마감일', wrong: '출발지' },
    { word: 'approve', answer: '승인하다', wrong: '거절하다' },
    { word: 'invoice', answer: '송장/청구서', wrong: '초대장' },
    { word: 'shipment', answer: '배송품', wrong: '가입서' },
    { word: 'inventory', answer: '재고', wrong: '면접' },
    { word: 'purchase', answer: '구매하다', wrong: '고용하다' },
    { word: 'refund', answer: '환불', wrong: '보고서' },
    { word: 'client', answer: '고객', wrong: '동료' },
    { word: 'budget', answer: '예산', wrong: '계약' },
    { word: 'schedule', answer: '일정', wrong: '설문' },
    { word: 'submit', answer: '제출하다', wrong: '연기하다' },
    { word: 'confirm', answer: '확인하다', wrong: '취소하다' },
    { word: 'branch', answer: '지점', wrong: '영수증' },
    { word: 'estimate', answer: '견적/추정하다', wrong: '교환하다' },
    { word: 'inspect', answer: '검사하다', wrong: '광고하다' },
    { word: 'delay', answer: '지연', wrong: '할인' },
    { word: 'benefit', answer: '혜택', wrong: '벌금' },
    { word: 'annual', answer: '연간의', wrong: '임시의' },
  ];

  const triggerDuolingoQuiz = (caster) => {
    const item = DUOLINGO_WORDS[Math.floor(Math.random() * DUOLINGO_WORDS.length)];
    const correctSide = Math.random() < 0.5 ? 'left' : 'right';
    const wrongSide = correctSide === 'left' ? 'right' : 'left';
    const overlay = document.createElement('div');
    overlay.className = 'duolingo-quiz-overlay';
    overlay.innerHTML = `
      <div class="quiz-word">${item.word}</div>
      <div class="quiz-choice quiz-left">${correctSide === 'left' ? item.answer : item.wrong}</div>
      <div class="quiz-choice quiz-right">${correctSide === 'right' ? item.answer : item.wrong}</div>
    `;
    root.querySelector('#live-battle-root')?.appendChild(overlay);
    showSkillName(caster, '듀오링고 퀴즈');
    setTimeout(() => {
      const wrongZoneLeft = wrongSide === 'left';
      const victims = units.filter((u) => u.alive && u.team !== caster.team && (wrongZoneLeft ? u.x < W / 2 : u.x >= W / 2));
      victims.forEach((victim) => damage(caster, victim, Math.round(caster.attack * 1.05)));
      overlay.remove();
    }, 3000);
  };

  let cinematicPlaying = false;
  const playCutscene = (src) => new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.68);z-index:9999;';
    const video = document.createElement('video');
    video.src = src;
    video.autoplay = true;
    video.playsInline = true;
    video.style.cssText = 'max-width:min(92vw,720px);max-height:72vh;border-radius:18px;box-shadow:0 20px 80px rgba(0,0,0,.5);';
    overlay.appendChild(video);
    document.body.appendChild(overlay);
    cinematicPlaying = true;
    const done = () => {
      cinematicPlaying = false;
      try { overlay.remove(); } catch (e) {}
      resolve();
    };
    video.onended = done;
    video.onerror = done;
    setTimeout(done, 2600);
  });


  const castBossSkill = (u) => {
    const target = closestEnemy(u);
    if (!target) return;
    if (u.weapon === 'crab' && performance.now() < (u.crabUntil || 0) && dist(u, target) <= u.radius + target.radius + 120) {
      const n = norm(u.x - target.x, u.y - target.y);
      target.slowUntil = performance.now() + 250;
      target.x = clamp(u.x - n.x * (u.radius + target.radius + 34), target.radius, W - target.radius);
      target.y = clamp(u.y - n.y * (u.radius + target.radius + 34), target.radius, H - target.radius);
    } else if (u.weapon === 'crab' && performance.now() >= (u.crabUntil || 0)) {
      u.weapon = null;
    }
    const skillIndex = Math.floor(Math.random() * 3);
    const dir = norm(target.x - u.x, target.y - u.y);
    if (u.character.id === 'diablo') {
      if (skillIndex === 0) {
        showSkillName(u, '지옥 화염');
        shotgun(u, target, { count: 5, spreadDeg: 12, damage: Math.round(u.attack * 0.78), speed: 8.2, range: 860, radius: 18 });
      } else if (skillIndex === 1) {
        showSkillName(u, '헬 레이저');
        for (let i = -2; i <= 2; i++) {
          spawnProjectile(u, dir.x, dir.y + i * 0.12, { damage: Math.round(u.attack * 0.62), speed: 9.4, range: 980, radius: 16 });
        }
      } else {
        showSkillName(u, '화염 폭발');
        for (let i = 0; i < 10; i++) {
          const a = Math.PI * 2 * i / 10;
          spawnProjectile(u, Math.cos(a), Math.sin(a), { isUltimate: true,  damage: Math.round(u.attack * 0.48), speed: 7.1, range: 720, radius: 18 });
        }
      }
    } else {
      if (skillIndex === 0) {
        showSkillName(u, '원자 브레스');
        for (let i = -1; i <= 1; i++) {
          spawnProjectile(u, dir.x, dir.y + i * 0.08, { damage: Math.round(u.attack * 0.68), speed: 10.2, range: 1080, radius: 20 });
        }
      } else if (skillIndex === 1) {
        showSkillName(u, '꼬리 충격파');
        for (let i = 0; i < 12; i++) {
          const a = Math.PI * 2 * i / 12;
          spawnProjectile(u, Math.cos(a), Math.sin(a), { isUltimate: true,  damage: Math.round(u.attack * 0.42), speed: 6.6, range: 680, radius: 16 });
        }
      } else {
        showSkillName(u, '등지느러미 탄막');
        shotgun(u, target, { count: 7, spreadDeg: 9, damage: Math.round(u.attack * 0.54), speed: 8.8, range: 900, radius: 18 });
      }
    }
    u.bossSkillAt = performance.now() + 2000;
  };

  const ultimate = async (u) => {
    const castX = u.x, castY = u.y;
    u.ultimateGauge = 0;
    u.lastUltimateAt = performance.now();
    showSkillName(u, u.character.ultimate?.name || '궁극기', castX, castY);
    pushLog(`${u.name} 궁극기`);
    if (u.character.id === 'zoro') await playCutscene('assets/cutscenes/horange.mp4');

    if (u.character.id === 'duolingo') {
      triggerDuolingoQuiz(u);
      return;
    }

    if (u.character.id === 'taric') {
      const until = performance.now() + 1000;
      units.filter((ally) => ally.team === u.team && ally.alive).forEach((ally) => {
        ally.invulnerableUntil = Math.max(ally.invulnerableUntil || 0, until);
        floatingTexts.push({ x: ally.x, y: ally.y - ally.radius - 18, text: '무적', life: 0.7, color: '#2ea8ff' });
      });
      return;
    }

    const target = closestEnemy(u);
    if (!target) return;

    const totalDamage = getUltimateTotalDamage(u);

    if (u.character.id === 'caitlyn') {
      const count = 2;
      shotgun(u, target, {
        count,
        spreadDeg: 4,
        speed: 10.5,
        damage: Math.max(1, Math.round(totalDamage / count)),
        radius: 24,
        range: 900,
        life: 2.7,
        image: u.character.ultimate?.image || u.character.skill1?.image,
        bouncesLeft: 1,
      });
      return;
    }

    if (u.character.id === 'batohtani') {
      const count = 3;
      for (let i = 0; i < count; i++) {
        spawnProjectile(u, 1, 0, {
          orbitOwnerId: u.id,
          angle: i * Math.PI * 2 / count,
          image: u.character.ultimate?.image,
          damage: Math.max(1, Math.round(totalDamage / count)),
          life: 5,
          radius: 22,
          bouncesLeft: 99,
        });
      }
      return;
    }

    const count = Math.min(BATTLE_NUMBERS.ultimateProjectileLimit || 6, u.character.id === 'hashirama' || u.character.id === 'madara' ? 6 : 5);
    const projectileDamage = Math.max(1, Math.round(totalDamage / count));
    for (let i = 0; i < count; i++) {
      const a = Math.PI * 2 * i / count + rand(-0.25, 0.25);
      spawnProjectile(u, Math.cos(a), Math.sin(a), {
        image: u.character.ultimate?.image || u.character.skill1?.image,
        damage: projectileDamage,
        speed: rand(6.2, 8.8),
        life: 3.3,
        radius: 18,
        bouncesLeft: 2,
        range: 760,
      });
    }
  };

  const spawnPickup = () => {
    if (!['control', 'auto', 'friendly', 'dungeon', 'raidSoloDiablo', 'raidSoloGodzilla', 'raidCoop'].includes(mode)) return;
    const roll = Math.random();
    const type = roll < 0.05 ? 'heal' : roll < 0.30 ? 'speed' : roll < 0.55 ? 'gauge' : roll < 0.70 ? 'shotgun' : roll < 0.85 ? 'sniper' : 'crab';
    pickups.push({
      id: `${Date.now()}_${Math.random()}`,
      type,
      x: rand(160, W - 160),
      y: rand(120, H - 120),
      radius: 20,
      life: 14,
    });
  };

  const applyPickup = (u, p) => {
    if (p.type === 'heal') {
      const amount = Math.round(u.maxHp * 0.18);
      u.hp = clamp(u.hp + amount, 0, u.maxHp);
      u.healing += amount;
      floatingTexts.push({ x: u.x, y: u.y - 40, text: `+${amount}`, life: 0.8, color: '#17c964' });
    } else if (p.type === 'speed') {
      u.speedBuff = 1.35;
      u.itemBuffUntil = performance.now() + 4500;
      floatingTexts.push({ x: u.x, y: u.y - 40, text: 'SPD+', life: 0.8, color: '#a9efa6' });
    } else if (p.type === 'gauge') {
      u.skillGauge = clamp(u.skillGauge + 45, 0, 100);
      u.ultimateGauge = clamp(u.ultimateGauge + 20, 0, 100);
      floatingTexts.push({ x: u.x, y: u.y - 40, text: 'GAUGE+', life: 0.8, color: '#f5a524' });
    } else if (p.type === 'shotgun') {
      u.weapon = 'shotgun';
      u.weaponCharges = 2;
      floatingTexts.push({ x: u.x, y: u.y - 40, text: '샷건 x2', life: 1.0, color: '#ffffff' });
    } else if (p.type === 'sniper') {
      u.weapon = 'sniper';
      u.weaponCharges = 2;
      floatingTexts.push({ x: u.x, y: u.y - 40, text: '스나이퍼 x2', life: 1.0, color: '#ffffff' });
    } else if (p.type === 'crab') {
      u.weapon = 'crab';
      u.crabUntil = performance.now() + 5000;
      floatingTexts.push({ x: u.x, y: u.y - 40, text: '집게발 5초', life: 1.0, color: '#ffffff' });
    }
  };

  const collideUnits = () => {
    for (let i = 0; i < units.length; i++) {
      for (let j = i + 1; j < units.length; j++) {
        const a = units[i], b = units[j];
        if (!a.alive || !b.alive) continue;
        const d = dist(a, b);
        const minD = a.radius + b.radius;
        if (d > 0 && d < minD) {
          const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
          const overlap = minD - d;
          const safeOverlap = Math.min(overlap, 6);
          const total = Math.max(1, a.attack + b.attack);
          const pushB = a.attack / total;
          const pushA = b.attack / total;
          a.x -= nx * safeOverlap * pushA;
          a.y -= ny * safeOverlap * pushA;
          b.x += nx * safeOverlap * pushB;
          b.y += ny * safeOverlap * pushB;
          if (mode === 'auto' || mode === 'dungeon') {
            const t = performance.now();
            if (t - a.lastContactBounceAt > 900) {
              a.vx = a.vx * 0.45 - nx * Math.max(0.6, a.speed * 0.25);
              a.vy = a.vy * 0.45 - ny * Math.max(0.6, a.speed * 0.25);
              a.lastContactBounceAt = t;
            }
            if (t - b.lastContactBounceAt > 900) {
              b.vx = b.vx * 0.45 + nx * Math.max(0.6, b.speed * 0.25);
              b.vy = b.vy * 0.45 + ny * Math.max(0.6, b.speed * 0.25);
              b.lastContactBounceAt = t;
            }
          }
        }
      }
    }
  };


  const getPickupTargetFor = (unit) => {
    if (!pickups.length || !unit.alive) return null;
    return pickups
      .filter((p) => p.life > 0)
      .sort((a, b) => Math.hypot(unit.x - a.x, unit.y - a.y) - Math.hypot(unit.x - b.x, unit.y - b.y))[0] || null;
  };

  const usePickupWeapon = (u, target) => {
    if (!u.weapon || u.weaponCharges <= 0 || !target) return;
    if (u.weapon === 'shotgun') {
      shotgun(u, target, { count: 5, spreadDeg: 18, damage: Math.max(1, Math.round(u.attack * 0.28)), speed: 7.2, range: 460, radius: 11, image: 'assets/weapons/shotgun.png' });
      const n = norm(target.x - u.x, target.y - u.y);
      target.x = clamp(target.x + n.x * 52, target.radius, W - target.radius);
      target.y = clamp(target.y + n.y * 52, target.radius, H - target.radius);
      u.weaponCharges -= 1;
      showSkillName(u, `샷건 ${u.weaponCharges}`);
    } else if (u.weapon === 'sniper') {
      const n = norm(target.x - u.x, target.y - u.y);
      spawnProjectile(u, n.x, n.y, { damage: Math.max(1, Math.round(u.attack * 0.56)), speed: 13.5, range: 980, radius: 9, image: 'assets/weapons/sniper.png' });
      u.weaponCharges -= 1;
      showSkillName(u, `스나이퍼 ${u.weaponCharges}`);
    }
    if (u.weaponCharges <= 0 && u.weapon !== 'crab') u.weapon = null;
  };

  const updateUnit = (u, dt, elapsed) => {
    if (!u.alive || finished) return;
    levelScale(u, elapsed);
    if (u.boss && performance.now() >= (u.bossSkillAt || 0)) castBossSkill(u);
    if (performance.now() > u.itemBuffUntil) u.speedBuff = 1;
    const gaugeMul = (mode === 'auto' || mode === 'dungeon' || mode === 'raidSoloDiablo' || mode === 'raidSoloGodzilla' || mode === 'raidCoop') ? 2.4 : 1.8;
    u.skillGauge = clamp(u.skillGauge + BATTLE_NUMBERS.skill1GaugeGainPerSecond * gaugeMul * dt, 0, 100);
    u.ultimateGauge = clamp(u.ultimateGauge + BATTLE_NUMBERS.ultimateGaugeGainPerSecond * gaugeMul * dt, 0, 100);

    const target = closestEnemy(u);
    let mx = 0, my = 0;
    const t = performance.now();
    const reverseMove = performance.now() < (u.reverseControlUntil || 0) ? -1 : 1;
    const slowMul = performance.now() < (u.slowUntil || 0) ? 0.72 : 1;
    const effectiveSpeed = u.speed * (u.speedBuff || 1) * slowMul;

    if (u.controlled && (mode === 'control' || mode === 'friendly' || mode === 'raidSoloDiablo' || mode === 'raidSoloGodzilla' || mode === 'raidCoop')) {
      mx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0) + input.x;
      my = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0) + input.y;
      const n = norm(mx, my);
      const len = Math.min(1, Math.hypot(mx, my));
      u.x += n.x * reverseMove * effectiveSpeed * 60 * dt * len;
      u.y += n.y * reverseMove * effectiveSpeed * 60 * dt * len;
    } else if (mode === 'friendly' && !u.controlled) {
      const remoteInput = friendlyInputs?.[u.ownerPlayerId] || {};
      mx = Number(remoteInput.x || 0);
      my = Number(remoteInput.y || 0);
      const n = norm(mx, my);
      const len = Math.min(1, Math.hypot(mx, my));
      u.x += n.x * reverseMove * effectiveSpeed * 60 * dt * len;
      u.y += n.y * reverseMove * effectiveSpeed * 60 * dt * len;
    } else if (mode === 'auto' || mode === 'dungeon' || ((mode === 'raidSoloDiablo' || mode === 'raidSoloGodzilla') && u.team === 'friend' && !u.controlled)) {
      const pickupTarget = getPickupTargetFor(u);
      if (pickupTarget) {
        const n = norm(pickupTarget.x - u.x, pickupTarget.y - u.y);
        u.vx = n.x * effectiveSpeed * 1.18;
        u.vy = n.y * effectiveSpeed * 1.18;
      }
      u.x += u.vx * 60 * dt;
      u.y += u.vy * 60 * dt;
      if (u.x <= u.radius || u.x >= W - u.radius) u.vx *= -1;
      if (u.y <= u.radius || u.y >= H - u.radius) u.vy *= -1;
      if (!pickupTarget && Math.random() < 0.008) {
        const a = rand(0, Math.PI * 2);
        u.vx = Math.cos(a) * effectiveSpeed;
        u.vy = Math.sin(a) * effectiveSpeed;
      }
    } else if (target) {
      const n = norm(target.x - u.x, target.y - u.y);
      const keep = u.character.attackType === 'projectile' && dist(u, target) < 300 ? -0.5 : 0.9;
      u.x += n.x * effectiveSpeed * 60 * dt * keep;
      u.y += n.y * effectiveSpeed * 60 * dt * keep;
    }

    if (u.controlled && isFriendly) syncFriendlyInput(false);

    u.x = clamp(u.x, u.radius, W - u.radius);
    u.y = clamp(u.y, u.radius, H - u.radius);

    if (u.controlled && input.blink) {
      if (t - u.lastBlinkAt >= (BATTLE_NUMBERS.blinkCooldownMs || 10000)) {
        const n = norm(mx || input.x || 1, my || input.y || 0);
        const castX = u.x, castY = u.y;
        const blinkDistance = BATTLE_NUMBERS.blinkDistance * (u.customEffects?.includes('teleportPlus') || u.customEffects?.includes('blinkHaste') ? 1.35 : 1);
        u.x = clamp(u.x + n.x * blinkDistance, u.radius, W - u.radius);
        u.y = clamp(u.y + n.y * blinkDistance, u.radius, H - u.radius);
        u.lastBlinkAt = t;
        showSkillName(u, '점멸', castX, castY);
        pushLog(`${u.name} 점멸`);
        if (isFriendly) syncFriendlyInput(true);
      }
      input.blink = false;
    }

    if (mode === 'friendly' && !u.controlled) {
      const remoteInputForBlink = friendlyInputs?.[u.ownerPlayerId] || {};
      const remoteBlink = remoteInputForBlink.blinkSeq !== undefined && remoteInputForBlink.blinkSeq !== u.lastRemoteBlinkSeq;
      if (remoteBlink) {
        if (t - u.lastBlinkAt >= (BATTLE_NUMBERS.blinkCooldownMs || 10000)) {
          const n = norm(mx || remoteInputForBlink.x || 1, my || remoteInputForBlink.y || 0);
          const castX = u.x, castY = u.y;
          u.x = clamp(u.x + n.x * BATTLE_NUMBERS.blinkDistance, u.radius, W - u.radius);
          u.y = clamp(u.y + n.y * BATTLE_NUMBERS.blinkDistance, u.radius, H - u.radius);
          u.lastBlinkAt = t;
          showSkillName(u, '점멸', castX, castY);
          pushLog(`${u.name} 점멸`);
        }
        u.lastRemoteBlinkSeq = remoteInputForBlink.blinkSeq;
      }
    }

    if (!target) return;
    if ((u.weapon === 'shotgun' || u.weapon === 'sniper') && t - u.lastShotAt >= 420) {
      usePickupWeapon(u, target);
      u.lastShotAt = t;
    }

    if (u.character.attackType === 'projectile' && t - u.lastShotAt >= BATTLE_NUMBERS.rangedAutoFireIntervalMs / Math.max(0.7, u.attackSpeed)) {
      shotgun(u, target, { count: 3, spreadDeg: 9, damage: Math.round(u.attack * 0.55), speed: u.character.battle?.projectileSpeed || BATTLE_NUMBERS.projectileBaseSpeed, range: u.character.battle?.projectileRange || 620 });
      u.lastShotAt = t;
    }

    if (u.character.attackType === 'melee' && dist(u, target) <= u.radius + target.radius + (u.character.battle?.meleeRange || 80) * 0.35 && t - u.lastAttackAt >= Math.max(260, 1000 / u.attackSpeed)) {
      damage(u, target, Math.round(u.attack * 0.72));
      u.lastAttackAt = t;
    }

    const remoteInput = mode === 'friendly' && !u.controlled ? (friendlyInputs?.[u.ownerPlayerId] || {}) : null;
    const remoteGhost = remoteInput && remoteInput.ghostSeq !== undefined && remoteInput.ghostSeq !== u.lastRemoteGhostSeq;
    if ((u.controlled && input.ghost) || remoteGhost) {
      if (u.character.attackType === 'melee' && t - u.lastGhostAt >= 6000) {
        u.speedBuff = 1.35;
        u.itemBuffUntil = t + 500;
        u.lastGhostAt = t;
        u.lastRemoteGhostSeq = remoteInput?.ghostSeq;
        showSkillName(u, '유체화');
      }
      if (u.controlled) {
        input.ghost = false;
        if (isFriendly) syncFriendlyInput(true);
      }
    }

    const remoteSkill = remoteInput && remoteInput.skillSeq !== undefined && remoteInput.skillSeq !== u.lastRemoteSkillSeq;
    const wantsSkill = (u.controlled && input.skill) || (mode === 'friendly' && !u.controlled && remoteSkill) || (!u.controlled && mode !== 'friendly' && u.skillGauge >= 100);
    if (wantsSkill) {
      if (u.skillGauge >= 100) {
        const n = norm(target.x - u.x, target.y - u.y);
        const castX = u.x, castY = u.y;
        u.skillGauge = 0;
        u.lastSkillAt = t;
        if (remoteInput) u.lastRemoteSkillSeq = remoteInput.skillSeq;
        showSkillName(u, u.character.skill1?.name || '스킬1', castX, castY);
        if (u.character.attackType === 'projectile') {
          shotgun(u, target, { count: 3, spreadDeg: 8, speed: (u.character.battle?.projectileSpeed || 5.9) + 0.9, damage: getSkill1Damage(u), radius: 17, range: 680, image: u.character.skill1?.image });
        } else {
          u.x = clamp(u.x + n.x * 78, u.radius, W - u.radius);
          u.y = clamp(u.y + n.y * 78, u.radius, H - u.radius);
          damage(u, target, getSkill1Damage(u));
        }
      }
      if (u.controlled) {
        input.skill = false;
        if (isFriendly) syncFriendlyInput(true);
      }
    }

    if (u.ultimateGauge >= 100) ultimate(u);
  };

  const updateProjectiles = (dt) => {
    for (const p of projectiles) {
      p.lastX = p.x;
      p.lastY = p.y;
      if (p.orbitOwnerId) {
        const owner = units.find((u) => u.id === p.orbitOwnerId && u.alive);
        if (owner) {
          p.angle += p.spinSpeed * dt;
          p.x = owner.x + Math.cos(p.angle) * p.orbitRadius;
          p.y = owner.y + Math.sin(p.angle) * p.orbitRadius;
        } else p.life = 0;
      } else {
        p.x += p.vx * 60 * dt;
        p.y += p.vy * 60 * dt;
        p.traveled += Math.hypot(p.x - p.lastX, p.y - p.lastY);
        if ((p.x <= p.radius || p.x >= W - p.radius) && p.bouncesLeft > 0) { p.vx *= -1; p.bouncesLeft--; }
        if ((p.y <= p.radius || p.y >= H - p.radius) && p.bouncesLeft > 0) { p.vy *= -1; p.bouncesLeft--; }
      }
      for (const u of units) {
        if (!u.alive || u.team === p.team) continue;
        if (Math.hypot(u.x - p.x, u.y - p.y) <= u.radius + p.radius) {
          const owner = units.find((x) => x.id === p.ownerId) || u;
          damage(owner, u, p.damage);
          if (!p.orbitOwnerId) p.life = 0;
          break;
        }
      }
      p.life -= dt;
    }
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      if (p.life <= 0 || p.bouncesLeft < 0 || p.traveled >= p.range) projectiles.splice(i, 1);
    }
  };

  const updatePickups = (dt) => {
    const t = performance.now();
    if (t >= nextPickupAt) {
      spawnPickup();
      nextPickupAt = t + rand(2500, 4500);
    }
    for (const p of pickups) {
      p.life -= dt;
      for (const u of units) {
        if (!u.alive) continue;
        if (Math.hypot(u.x - p.x, u.y - p.y) <= u.radius + p.radius) {
          applyPickup(u, p);
          p.life = 0;
          break;
        }
      }
    }
    for (let i = pickups.length - 1; i >= 0; i--) if (pickups[i].life <= 0) pickups.splice(i, 1);
  };

  const checkEnd = (elapsed) => {
    const f = alive('friend'), e = alive('enemy');
    const limit = mode === 'dungeon' ? BATTLE_NUMBERS.dungeonTimeLimitSeconds : mode === 'control' || mode === 'friendly' ? BATTLE_NUMBERS.controlTimeLimitSeconds : 9999;
    if (!e.length || !f.length || elapsed >= limit) {
      const win = !!f.length && !e.length;
      statusEl.textContent = win ? '승리' : '패배';
      statusEl.className = win ? 'pill green' : 'pill';
      showResult(win, elapsed);
    }
  };


  const serializeBattleState = (elapsed = 0) => ({
    elapsed,
    updatedAt: Date.now(),
    units: units.map((u) => ({
      id: u.id,
      ownerPlayerId: u.ownerPlayerId || '',
      characterId: u.characterId,
      team: u.team,
      x: Math.round(u.x),
      y: Math.round(u.y),
      hp: Math.round(u.hp),
      maxHp: u.maxHp,
      alive: u.alive,
      level: u.level,
      radius: u.radius,
      skillGauge: Math.floor(u.skillGauge),
      ultimateGauge: Math.floor(u.ultimateGauge),
      lastBlinkAt: u.lastBlinkAt || 0,
      lastGhostAt: u.lastGhostAt || 0,
      kills: u.kills || 0,
      deaths: u.deaths || 0,
      damage: u.damage || 0,
      damageTaken: u.damageTaken || 0,
    })),
    projectiles: projectiles.slice(0, 80).map((p) => ({
      ...p,
      x: Math.round(p.x),
      y: Math.round(p.y),
      vx: p.vx,
      vy: p.vy,
      life: p.life,
    })),
    pickups: pickups.slice(0, 20).map((p) => ({ ...p })),
    floatingTexts: floatingTexts.slice(0, 20).map((f) => ({ ...f })),
  });

  const publishBattleState = (elapsed = 0, force = false) => {
    if (!isFriendly || !isFriendlyHost || !room?.id) return;
    const now = performance.now();
    if (!force && now - lastHostStateSyncAt < 90) return;
    lastHostStateSyncAt = now;
    updateRoomRemote(room.id, {
      battleState: serializeBattleState(elapsed),
    }).catch(() => {});
  };

  const applyFriendlyBattleState = () => {
    if (!isFriendly || isFriendlyHost || !friendlyBattleState?.units) return;
    const hostUnits = friendlyBattleState.units || [];
    hostUnits.forEach((snap) => {
      const u = units.find((unit) => unit.ownerPlayerId && unit.ownerPlayerId === snap.ownerPlayerId)
        || units.find((unit) => unit.characterId === snap.characterId);
      if (!u) return;
      u.x = snap.x; u.y = snap.y;
      u.hp = snap.hp; u.maxHp = snap.maxHp;
      u.alive = !!snap.alive;
      u.level = snap.level || u.level;
      u.radius = snap.radius || u.radius;
      u.skillGauge = snap.skillGauge || 0;
      u.ultimateGauge = snap.ultimateGauge || 0;
      u.lastBlinkAt = snap.lastBlinkAt || u.lastBlinkAt || 0;
      u.lastGhostAt = snap.lastGhostAt || u.lastGhostAt || 0;
      u.kills = snap.kills || 0;
      u.deaths = snap.deaths || 0;
      u.damage = snap.damage || 0;
      u.damageTaken = snap.damageTaken || 0;
      if (snap.ownerPlayerId) u.team = snap.ownerPlayerId === localPlayerId ? 'friend' : 'enemy';
    });

    const ownerTeam = (ownerId) => {
      const hostUnit = hostUnits.find((u) => u.id === ownerId);
      if (!hostUnit?.ownerPlayerId) return 'enemy';
      return hostUnit.ownerPlayerId === localPlayerId ? 'friend' : 'enemy';
    };
    projectiles.splice(0, projectiles.length, ...(friendlyBattleState.projectiles || []).map((p) => ({
      ...p,
      team: ownerTeam(p.ownerId),
    })));
    pickups.splice(0, pickups.length, ...(friendlyBattleState.pickups || []));
    floatingTexts.splice(0, floatingTexts.length, ...(friendlyBattleState.floatingTexts || []));
  };

  const drawUnit = (u) => {
    ctx.save();
    ctx.globalAlpha = u.alive ? 1 : 0.25;
    ctx.beginPath(); ctx.arc(u.x, u.y, u.radius, 0, Math.PI * 2); ctx.fillStyle = '#eef9ea'; ctx.fill();
    ctx.lineWidth = u.boss ? 6 : 4; ctx.strokeStyle = u.team === 'friend' ? '#17c964' : '#f54f66'; ctx.stroke(); ctx.clip();
    const img = images.get(u.character.image);
    if (img?.complete && img.naturalWidth) ctx.drawImage(img, u.x - u.radius, u.y - u.radius, u.radius * 2, u.radius * 2);
    ctx.restore();
    ctx.fillStyle = '#07130d'; ctx.font = '800 12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`Lv.${u.level} ${u.name}`, u.x, u.y - u.radius - 22);
    const w = 88, x = u.x - w / 2, y = u.y - u.radius - 16;
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x, y, w, 8);
    ctx.fillStyle = u.team === 'friend' ? '#17c964' : '#f54f66'; ctx.fillRect(x, y, w * Math.max(0, u.hp / u.maxHp), 8);
  };

  const drawProjectile = (p) => {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx));
    const img = skillImages.get(p.image);
    if (img?.complete && img.naturalWidth) ctx.drawImage(img, -p.radius, -p.radius, p.radius * 2, p.radius * 2);
    else { ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.fillStyle = p.team === 'friend' ? '#d6ffd2' : '#ffd36e'; ctx.fill(); }
    ctx.restore();
  };

  const drawPickup = (p) => {
    ctx.save();
    const weaponIcon = p.type === 'shotgun' ? 'assets/weapons/shotgun.png' : p.type === 'sniper' ? 'assets/weapons/sniper.png' : p.type === 'crab' ? 'assets/weapons/crab.png' : '';
    if (weaponIcon) {
      loadImg(weaponIcon, skillImages);
      const img = skillImages.get(weaponIcon);
      if (img?.complete && img.naturalWidth) ctx.drawImage(img, p.x - p.radius, p.y - p.radius, p.radius * 2, p.radius * 2);
      else { ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill(); }
    } else {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.type === 'heal' ? '#17c964' : p.type === 'speed' ? '#7ee787' : '#f5a524';
      ctx.fill();
      ctx.fillStyle = '#07130d'; ctx.font = '900 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.type === 'heal' ? '+' : p.type === 'speed' ? 'S' : 'G', p.x, p.y);
    }
    ctx.restore();
  };

  const draw = (elapsed) => {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#153326'); grad.addColorStop(0.55, '#315e35'); grad.addColorStop(1, '#a9efa6');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    pickups.forEach(drawPickup); pickups.forEach(drawPickup); projectiles.forEach(drawProjectile); units.forEach(drawUnit);
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i]; ft.y -= 0.5; ft.life -= 1 / 60;
      ctx.globalAlpha = Math.max(0, ft.life); ctx.fillStyle = ft.color; ctx.font = '900 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(ft.text, ft.x, ft.y); ctx.globalAlpha = 1;
      if (ft.life <= 0) floatingTexts.splice(i, 1);
    }
    const limit = mode === 'dungeon' ? BATTLE_NUMBERS.dungeonTimeLimitSeconds : BATTLE_NUMBERS.controlTimeLimitSeconds;
    const remain = Math.max(0, Math.floor(limit - elapsed));
    timerEl.textContent = mode === 'auto' ? `${Math.floor(elapsed)}s` : `${Math.floor(remain / 60)}:${String(remain % 60).padStart(2, '0')}`;
  };

  const formatCooldownSeconds = (ms) => {
    const left = Math.max(0, ms || 0);
    return left <= 0 ? '' : `${Math.ceil(left / 1000)}초`;
  };

  const drawCountdown = (time) => {
    if (time >= battleStartAt) return;
    const remain = battleStartAt - time;
    const label = remain > 3000 ? '3' : remain > 2000 ? '2' : remain > 1000 ? '1' : 'START';
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.36)';
    ctx.fillRect(0, 0, W, H);
    ctx.font = label === 'START' ? '900 72px sans-serif' : '900 96px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,.5)';
    ctx.shadowBlur = 18;
    ctx.fillText(label, W / 2, H / 2);
    ctx.restore();
  };

  const hud = () => {
    const side = (team) => units.filter((u) => u.team === team).map((u) => `
      <div class="battle-live-unit ${u.alive ? '' : 'dead'}">
        <strong>${u.name}</strong><span>Lv.${u.level}</span>
        <div class="hp-bar"><span style="width:${Math.max(0, u.hp / u.maxHp * 100)}%"></span></div>
        <div class="title-row battle-hp-row battle-hud-text"><span>HP</span><span class="battle-hp-number">${Math.round(u.hp)} / ${u.maxHp}</span></div>
        <div class="title-row battle-hud-text"><span>스킬1</span><span>${Math.floor(u.skillGauge)}%</span></div>
        <div class="skill-gauge"><span style="width:${u.skillGauge}%"></span></div>
        <div class="title-row battle-hud-text"><span>궁극기</span><span>${Math.floor(u.ultimateGauge)}%</span></div>
        <div class="skill-gauge"><span style="width:${u.ultimateGauge}%;background:linear-gradient(90deg,#f5a524,#ffd36e);"></span></div>
      </div>`).join('');
    friendHud.innerHTML = side('friend'); enemyHud.innerHTML = side('enemy');

    const me = units.find((u) => u.controlled && u.team === 'friend') || units.find((u) => u.team === 'friend');
    if (me) {
      const now = performance.now();
      const skillBtn = root.querySelector('[data-battle-skill]');
      const blinkBtn = root.querySelector('[data-battle-blink]');
      const ghostBtn = root.querySelector('[data-battle-ghost]');
      if (skillBtn) {
        const ready = Math.floor(me.skillGauge) >= 100;
        skillBtn.innerHTML = `<span>${me.character.skill1?.name || '스킬1'}</span><small>${ready ? '준비완료' : `${Math.floor(me.skillGauge)}%`}</small>`;
        skillBtn.classList.toggle('ready', ready);
      }
      if (blinkBtn) {
        const cd = formatCooldownSeconds((BATTLE_NUMBERS.blinkCooldownMs || 10000) - (now - (me.lastBlinkAt || 0)));
        blinkBtn.innerHTML = `<span>점멸</span><small>${cd || '준비완료'}</small>`;
        blinkBtn.classList.toggle('ready', !cd);
      }
      if (ghostBtn) {
        const cd = formatCooldownSeconds(6000 - (now - (me.lastGhostAt || 0)));
        ghostBtn.innerHTML = `<span>유체화</span><small>${cd || '준비완료'}</small>`;
        ghostBtn.classList.toggle('ready', !cd);
      }
    }
  };

  const loop = (time) => {
    const rawDt = Math.min(0.05, (time - last) / 1000);
    last = time;
    const elapsed = Math.max(0, (time - battleStartAt) / 1000);

    if (time < battleStartAt) {
      draw(0);
      drawCountdown(time);
      if (time - lastHud > 120) { hud(); lastHud = time; }
      raf = requestAnimationFrame(loop);
      return;
    }

    if (!countdownLogged) {
      countdownLogged = true;
      pushLog('START');
    }

    if (cinematicPlaying) {
      draw(elapsed);
      if (time - lastHud > 120) { hud(); lastHud = time; }
      raf = requestAnimationFrame(loop);
      return;
    }

    if (isFriendly && !isFriendlyHost) {
      applyFriendlyBattleState();
      draw(friendlyBattleState?.elapsed || elapsed);
      if (time - lastHud > 120) { hud(); lastHud = time; }
      raf = requestAnimationFrame(loop);
      return;
    }

    if (!finished) {
      try {
        units.forEach((u) => updateUnit(u, rawDt, elapsed));
        collideUnits();
        updateProjectiles(rawDt);
        updatePickups(rawDt);
        checkEnd(elapsed);
        publishBattleState(elapsed);
      } catch (error) {
        console.error('battle loop error:', error);
        pushLog('전투 오류 자동 복구');
      }
    }
    draw(elapsed);
    if (time - lastHud > 120) { hud(); lastHud = time; }
    raf = requestAnimationFrame(loop);
  };

  const keyDown = (e) => {
    keys[e.code] = true;
    if (e.code === 'Space') { input.skill = true; if (isFriendly) { friendlyInput.skillSeq += 1; syncFriendlyInput(true); } }
    if (e.code === 'KeyE') { input.ghost = true; if (isFriendly) { friendlyInput.ghostSeq += 1; syncFriendlyInput(true); } }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { input.blink = true; if (isFriendly) { friendlyInput.blinkSeq += 1; syncFriendlyInput(true); } }
  };
  const keyUp = (e) => { keys[e.code] = false; };
  window.addEventListener('keydown', keyDown); window.addEventListener('keyup', keyUp);

  
  const joy = root.querySelector('#battle-joystick');
  const knob = root.querySelector('#battle-joystick-knob');
  const joyWrap = root.querySelector('.live-stick-wrap');
  let joyActive = false;
  const resetJoy = () => {
    input.x = 0; input.y = 0;
    if (knob) { knob.style.left = '39px'; knob.style.top = '39px'; }
  };
  const setJoy = (e) => {
    if (!joy || !knob) return;
    const rect = joy.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx, dy = e.clientY - cy;
    const max = rect.width * 0.34;
    const len = Math.min(max, Math.hypot(dx, dy));
    const n = norm(dx, dy);
    input.x = n.x * (len / max);
    input.y = n.y * (len / max);
    knob.style.left = `${39 + n.x * len}px`;
    knob.style.top = `${39 + n.y * len}px`;
    if (isFriendly) syncFriendlyInput(false);
  };
  const startJoy = (e) => {
    if (!joy) return;
    e.preventDefault();
    const px = e.clientX;
    const py = e.clientY;
    joy.style.left = `${Math.max(8, px - 66)}px`;
    joy.style.bottom = `${Math.max(8, (window.innerHeight - py) - 66)}px`;
    joyActive = true;
    try { joy.setPointerCapture?.(e.pointerId); } catch (error) {}
    setJoy(e);
  };
  joy?.addEventListener('pointerdown', startJoy, { passive: false });
  joyWrap?.addEventListener('pointerdown', startJoy, { passive: false });
  window.addEventListener('pointermove', (e) => { if (joyActive) { e.preventDefault(); setJoy(e); } }, { passive: false });
  const endJoy = () => { joyActive = false; resetJoy(); if (isFriendly) syncFriendlyInput(true); };
  window.addEventListener('pointerup', endJoy, { passive: true });
  window.addEventListener('pointercancel', endJoy, { passive: true });

  const triggerBattleButton = (target) => {
    if (!target) return false;
    if (target.closest('[data-battle-skill]')) {
      input.skill = true;
      if (isFriendly) {
        friendlyInput.skillSeq += 1;
        syncFriendlyInput(true);
      }
      return true;
    }
    if (target.closest('[data-battle-ghost]')) {
      input.ghost = true;
      if (isFriendly) {
        friendlyInput.ghostSeq += 1;
        syncFriendlyInput(true);
      }
      return true;
    }
    if (target.closest('[data-battle-blink]')) {
      input.blink = true;
      if (isFriendly) {
        friendlyInput.blinkSeq += 1;
        syncFriendlyInput(true);
      }
      return true;
    }
    return false;
  };
  const battleButtonDown = (e) => {
    if (triggerBattleButton(e.target)) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  root.addEventListener('pointerdown', battleButtonDown, true);
  root.addEventListener('touchstart', battleButtonDown, true);
  root.addEventListener('click', battleButtonDown, true);
  root.querySelectorAll('[data-battle-skill],[data-battle-blink],[data-battle-ghost]').forEach((btn) => {
    btn.addEventListener('pointerdown', battleButtonDown, { capture: true });
    btn.addEventListener('touchstart', battleButtonDown, { capture: true, passive: false });
    btn.addEventListener('click', battleButtonDown, { capture: true });
  });

  pushLog('카운트다운 시작');
  hud();
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', keyDown);
    window.removeEventListener('keyup', keyUp);
    root.removeEventListener('pointerdown', battleButtonDown, true);
    root.removeEventListener('touchstart', battleButtonDown, true);
    root.removeEventListener('click', battleButtonDown, true);
    if (unwatchFriendlyRoom) unwatchFriendlyRoom();
  };
};
