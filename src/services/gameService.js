import { APP_CONFIG } from '../config.js';
import { CHARACTER_LIST, CHARACTER_MAP, getRandomCharacterId, getTierFromPoints } from '../data/characters.js';
import { MISSIONS } from '../data/missions.js';
import { ITEM_MAP, ITEM_PACKS } from '../data/items.js';

export const nowIso = () => new Date().toISOString();
export const uid = (prefix = 'id') => `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;

export const buildDefaultStats = () => ({
  kills: 0,
  damage: 0,
  survivalTime: 0,
  tankGames: 0,
  rankedWins: 0,
  rankedLosses: 0,
  rankedPointsControl: 0,
  rankedPointsAuto: 0,
  dungeonClears: 0,
  challengeWins: 0,
  totalMatches: 0,
});



export const CUSTOM_MATERIAL_EFFECTS = {
  teleportPlus: {
    label: '텔레포트 강화',
    materialCost: 3,
    stats: { hp: 20, attack: 2, attackSpeed: 0.02, speed: 0.05, critChance: 0 },
    description: '점멸 거리가 증가합니다.',
  },
  attackSpeedPlus: {
    label: '공격속도 증가',
    materialCost: 3,
    stats: { hp: 0, attack: 2, attackSpeed: 0.18, speed: 0.02, critChance: 0 },
    description: '공격속도가 상승합니다.',
  },
  reverseControl: {
    label: '조작 반전',
    materialCost: 4,
    stats: { hp: 30, attack: 4, attackSpeed: 0.02, speed: 0, critChance: 2 },
    description: '공격 시 낮은 확률로 상대 조작을 2초 반전시킵니다.',
  },
  slowHit: {
    label: '둔화 타격',
    materialCost: 3,
    stats: { hp: 35, attack: 3, attackSpeed: 0.02, speed: 0, critChance: 0 },
    description: '공격 적중 시 상대 이동속도를 1초 늦춥니다.',
  },
  blinkHaste: {
    label: '점멸 강화',
    materialCost: 3,
    stats: { hp: 0, attack: 2, attackSpeed: 0.04, speed: 0.08, critChance: 1 },
    description: '점멸 성능이 강화됩니다.',
  },
  critFocus: {
    label: '치명 집중',
    materialCost: 3,
    stats: { hp: 0, attack: 5, attackSpeed: 0.03, speed: 0, critChance: 6 },
    description: '치명타 확률과 공격력이 상승합니다.',
  },
};

export const CUSTOM_ITEM_RECIPES = [
  {
    id: 'phase_drive',
    name: '위상 드라이브',
    rarity: '커스텀',
    description: '텔레포트 + 공격속도 증가 조합. 점멸 거리가 증가하고 공격속도가 상승합니다.',
    materialCost: 5,
    stats: { hp: 0, attack: 8, attackSpeed: 0.18, speed: 0.08, critChance: 0 },
    effects: ['teleportPlus', 'attackSpeedPlus']
  },
  {
    id: 'chaos_hack',
    name: '카오스 해킹칩',
    rarity: '커스텀',
    description: '상대 조작 반전 + 둔화 조합. 공격 시 낮은 확률로 조작을 2초 반전시키고 이동속도를 늦춥니다.',
    materialCost: 6,
    stats: { hp: 60, attack: 10, attackSpeed: 0.05, speed: 0, critChance: 6 },
    effects: ['reverseControl', 'slowHit']
  },
  {
    id: 'overclock_core',
    name: '오버클럭 코어',
    rarity: '커스텀',
    description: '공격속도 증가 + 짧은 순간이동 강화 조합.',
    materialCost: 4,
    stats: { hp: 40, attack: 6, attackSpeed: 0.22, speed: 0.12, critChance: 4 },
    effects: ['attackSpeedPlus', 'blinkHaste']
  },
  {
    id: 'gravity_lock',
    name: '그래비티 락',
    rarity: '커스텀',
    description: '짧은 텔레포트 + 적 이동 둔화 조합.',
    materialCost: 5,
    stats: { hp: 90, attack: 12, attackSpeed: 0.06, speed: 0.06, critChance: 0 },
    effects: ['teleportPlus', 'slowHit']
  },
];

export const buildDefaultPlayer = (nickname) => {
  const starter = getRandomCharacterId();
  return {
    id: uid('player'),
    nickname,
    title: APP_CONFIG.defaultTitle,
    acquiredTitles: { [APP_CONFIG.defaultTitle]: { obtainedAt: nowIso(), source: '기본 칭호' } },
    logoText: nickname.slice(0, 2).toUpperCase(),
    gold: APP_CONFIG.defaultGold,
    customItems: {},
    createdAt: nowIso(),
    updatedAt: nowIso(),
    activeCharacterId: starter,
    autoSquad: [starter],
    ownedCharacters: {
      [starter]: { level: 1, enhancement: 0, obtainedAt: nowIso() },
    },
    inventory: {
      characterPacks: 0,
      basicItemPacks: 0,
      epicItemPacks: 0,
      boostStones: 0,
      titleCoupons: 0,
      customMaterials: 0,
    },
    items: {},
    equippedItems: {},
    missionsClaimed: {},
    devModeEnabled: false,
    settings: { volume: APP_CONFIG.defaultVolume || 0.5 },
    dungeonRuns: 0,
    borrowCharacterAvailable: false,
    borrowedCharacterId: null,
    stats: buildDefaultStats(),
    meta: {
      lastViewedTab: 'main',
      controlWagerDefault: 10,
      autoWagerDefault: 10,
    },
  };
};

export const enrichPlayer = (player) => {
  if (!player) return null;
  const controlPoints = player?.stats?.rankedPointsControl || 0;
  const autoPoints = player?.stats?.rankedPointsAuto || 0;
  const ownedIds = Object.keys(player.ownedCharacters || {});
  const teamValue = ownedIds.reduce((sum, id) => sum + Math.round(getCharacterPower(player, id) * 8), 0);
  const titleList = Object.keys(player.acquiredTitles || { [player.title || APP_CONFIG.defaultTitle]: true });
  return {
    ...player,
    teamValue,
    teamBattlePower: getTeamPower(player),
    titleList,
    tierControl: getTierFromPoints(controlPoints),
    tierAuto: getTierFromPoints(autoPoints),
    activeCharacter: CHARACTER_MAP[player.activeCharacterId],
    autoCharacters: (player.autoSquad || []).map((id) => CHARACTER_MAP[id]).filter(Boolean),
    ownedCharacterObjects: Object.keys(player.ownedCharacters || {}).map((id) => ({
      ...(CHARACTER_MAP[id] || {}),
      ownership: player.ownedCharacters[id],
      id,
    })),
  };
};

export const listUnownedCharacters = (player) => CHARACTER_LIST.filter((character) => !player?.ownedCharacters?.[character.id]);

export const grantCharacter = (player, characterId) => {
  if (!player.ownedCharacters[characterId]) {
    player.ownedCharacters[characterId] = { level: 1, enhancement: 0, obtainedAt: nowIso() };
  }
  if (!player.activeCharacterId) player.activeCharacterId = characterId;
  if (!player.autoSquad?.length) player.autoSquad = [characterId];
  player.updatedAt = nowIso();
  return player;
};

export const openCharacterPack = (player) => {
  if (player.gold < APP_CONFIG.packPrice) {
    return { ok: false, reason: '골드가 부족합니다.' };
  }
  player.gold -= APP_CONFIG.packPrice;
  const unowned = listUnownedCharacters(player);
  const wonCharacter = (unowned.length ? unowned : CHARACTER_LIST)[Math.floor(Math.random() * (unowned.length ? unowned.length : CHARACTER_LIST.length))];
  grantCharacter(player, wonCharacter.id);
  player.updatedAt = nowIso();
  return { ok: true, character: wonCharacter, duplicate: !unowned.length };
};


export const grantItem = (player, itemId, count = 1) => {
  const item = ITEM_MAP[itemId];
  if (!item) return player;
  player.items = player.items || {};
  const current = player.items[itemId] || { count: 0, obtainedAt: nowIso() };
  player.items[itemId] = {
    ...current,
    count: (current.count || 0) + count,
    lastObtainedAt: nowIso(),
  };
  player.updatedAt = nowIso();
  return player;
};

export const openItemPack = (player, packType = 'basic') => {
  const pack = ITEM_PACKS[packType];
  if (!pack) return { ok: false, reason: '존재하지 않는 아이템 팩입니다.' };
  if (player.gold < pack.price) return { ok: false, reason: '골드가 부족합니다.' };

  player.gold -= pack.price;
  const itemId = pack.pool[Math.floor(Math.random() * pack.pool.length)];
  const item = ITEM_MAP[itemId];
  grantItem(player, itemId, 1);

  player.inventory = player.inventory || {};
  if (packType === 'basic') player.inventory.basicItemPacks = (player.inventory.basicItemPacks || 0) + 1;
  if (packType === 'epic') player.inventory.epicItemPacks = (player.inventory.epicItemPacks || 0) + 1;

  player.updatedAt = nowIso();
  return { ok: true, pack, item };
};


export const buyCharacter = (player, characterId) => {
  const character = CHARACTER_MAP[characterId];
  if (!character) return { ok: false, reason: '존재하지 않는 캐릭터입니다.' };
  if (player.ownedCharacters[characterId]) return { ok: false, reason: '이미 보유한 캐릭터입니다.' };
  if (player.gold < character.shopPrice) return { ok: false, reason: '골드가 부족합니다.' };
  player.gold -= character.shopPrice;
  grantCharacter(player, characterId);
  return { ok: true, character };
};

export const getEnhancementCost = (currentEnhancement) => 800 + currentEnhancement * 450;
export const getEnhancementRate = (currentEnhancement) => Math.max(15, 100 - currentEnhancement * 9);

export const enhanceCharacter = (player, characterId) => {
  const ownership = player.ownedCharacters?.[characterId];
  if (!ownership) return { ok: false, reason: '보유하지 않은 캐릭터입니다.' };
  if (ownership.enhancement >= APP_CONFIG.maxEnhancement) return { ok: false, reason: '이미 최대 강화입니다.' };
  const cost = getEnhancementCost(ownership.enhancement);
  if (player.gold < cost) return { ok: false, reason: '골드가 부족합니다.' };
  player.gold -= cost;
  const rate = getEnhancementRate(ownership.enhancement);
  const success = Math.random() * 100 <= rate;
  if (success) {
    ownership.enhancement += 1;
  }
  player.updatedAt = nowIso();
  return { ok: true, success, cost, rate, enhancement: ownership.enhancement };
};

export const getCharacterPower = (player, characterId) => {
  const meta = player.ownedCharacters?.[characterId];
  const character = CHARACTER_MAP[characterId];
  if (!character) return 0;
  const level = meta?.level || 1;
  const enhancement = meta?.enhancement || 0;
  return Math.round(
    character.baseStats.attack * 2.1 +
    character.baseStats.hp * 0.11 +
    character.baseStats.attackSpeed * 70 +
    character.baseStats.speed * 42 +
    character.baseStats.critChance * 8 +
    level * 10 +
    enhancement * 45
  );
};

export const simulateRankedMatch = (player, mode = 'control') => {
  const characterIds = mode === 'control'
    ? [player.activeCharacterId]
    : [...new Set((player.autoSquad || []).slice(0, 2))];
  const teamPower = characterIds.reduce((sum, id) => sum + getCharacterPower(player, id), 0) || 1000;
  const enemyPower = 950 + Math.random() * 650 + (mode === 'auto' ? 250 : 0) + ((mode === 'control' ? player.stats.rankedPointsControl : player.stats.rankedPointsAuto) * 3);
  const variance = 0.85 + Math.random() * 0.3;
  const resultPower = teamPower * variance;
  const win = resultPower >= enemyPower;
  const pointsDelta = win ? randomRange(10, 15) : -randomRange(5, 7);
  const rewardGold = win ? APP_CONFIG.rankedRewardGold : 0;
  const damage = Math.floor(resultPower * (win ? 1.15 : 0.85));
  const kills = win ? (mode === 'auto' ? 2 : 1) : Math.random() > 0.6 ? 1 : 0;
  const survivalTime = win ? randomRange(95, 180) : randomRange(45, 140);

  player.gold += rewardGold;
  player.stats.totalMatches += 1;
  player.stats.damage += damage;
  player.stats.kills += kills;
  player.stats.survivalTime = Math.max(player.stats.survivalTime || 0, survivalTime);

  if (mode === 'control') {
    player.stats.rankedPointsControl = Math.max(0, player.stats.rankedPointsControl + pointsDelta);
  } else {
    player.stats.rankedPointsAuto = Math.max(0, player.stats.rankedPointsAuto + pointsDelta);
  }
  if (win) player.stats.rankedWins += 1;
  else player.stats.rankedLosses += 1;

  player.updatedAt = nowIso();
  return {
    mode,
    win,
    pointsDelta,
    rewardGold,
    kills,
    damage,
    survivalTime,
    nextTier: getTierFromPoints(mode === 'control' ? player.stats.rankedPointsControl : player.stats.rankedPointsAuto),
  };
};

export const simulateProfileChallenge = (player) => {
  if (player.gold < APP_CONFIG.challengeCost) return { ok: false, reason: '도전 골드가 부족합니다.' };
  player.gold -= APP_CONFIG.challengeCost;
  const teamPower = (player.autoSquad || []).slice(0, 2).reduce((sum, id) => sum + getCharacterPower(player, id), 0) || 1000;
  const enemyPower = 1200 + Math.random() * 700;
  const win = teamPower * (0.85 + Math.random() * 0.35) >= enemyPower;
  if (win) {
    player.gold += APP_CONFIG.challengeReward;
    player.stats.challengeWins += 1;
  }
  player.stats.totalMatches += 1;
  player.updatedAt = nowIso();
  return { ok: true, win, rewardGold: win ? APP_CONFIG.challengeReward : 0 };
};

export const simulateDungeon = (player) => {
  const teamIds = [...new Set((player.autoSquad || []).slice(0, 2))];
  const borrowedAvailable = player.borrowCharacterAvailable && player.borrowedCharacterId;
  if (teamIds.length < 2 && !borrowedAvailable) return { ok: false, reason: '오토모드용 캐릭터 2명이 필요합니다.' };
  if (teamIds.length < 2 && borrowedAvailable) teamIds.push(player.borrowedCharacterId);
  player.dungeonRuns += 1;
  const bossPower = 1800 + player.stats.dungeonClears * 110 + Math.random() * 350;
  const teamPower = teamIds.reduce((sum, id) => sum + getCharacterPower(player, id), 0);
  const win = teamPower * (0.88 + Math.random() * 0.28) >= bossPower;
  if (win) {
    player.gold += APP_CONFIG.dungeonReward;
    player.stats.dungeonClears += 1;
  }
  if (player.dungeonRuns % 5 === 0) {
    player.borrowCharacterAvailable = true;
    player.borrowedCharacterId = getRandomCharacterId(Object.keys(player.ownedCharacters || {}));
  }
  player.updatedAt = nowIso();
  return { ok: true, win, rewardGold: win ? APP_CONFIG.dungeonReward : 0, bossPower: Math.round(bossPower), teamIds };
};

export const claimMission = (player, missionId) => {
  const mission = MISSIONS.find((item) => item.id === missionId);
  if (!mission) return { ok: false, reason: '존재하지 않는 미션입니다.' };
  if (player.missionsClaimed?.[missionId]) return { ok: false, reason: '이미 수령했습니다.' };
  const progress = getMissionProgress(player, mission);
  if (progress < mission.target) return { ok: false, reason: '조건을 아직 달성하지 못했습니다.' };
  player.missionsClaimed = player.missionsClaimed || {};
  player.missionsClaimed[missionId] = { claimedAt: nowIso() };
  player.gold += mission.rewardGold;
  if (mission.rewardTitle) {
    player.title = mission.rewardTitle;
    player.acquiredTitles = player.acquiredTitles || {};
    player.acquiredTitles[mission.rewardTitle] = { obtainedAt: nowIso(), source: mission.name };
  }
  player.updatedAt = nowIso();
  return { ok: true, mission };
};

export const getMissionProgress = (player, mission) => {
  const stats = player.stats || {};
  switch (mission.type) {
    case 'kills': return stats.kills || 0;
    case 'damage': return stats.damage || 0;
    case 'survivalTime': return stats.survivalTime || 0;
    case 'rankedWins': return stats.rankedWins || 0;
    case 'dungeonClears': return stats.dungeonClears || 0;
    default: return 0;
  }
};

export const buildLeaderboardRows = (profiles = []) => {
  const base = profiles.map((item) => {
    const controlPoints = item.stats?.rankedPointsControl || 0;
    const autoPoints = item.stats?.rankedPointsAuto || 0;
    const activeCharacter = CHARACTER_MAP[item.activeCharacterId];
    return {
      nickname: item.nickname,
      title: item.title,
      activeCharacterId: item.activeCharacterId,
      activeCharacterName: activeCharacter?.name || '-',
      activeCharacterImage: activeCharacter?.image || '',
      controlTier: getTierFromPoints(controlPoints),
      autoTier: getTierFromPoints(autoPoints),
      controlPoints,
      autoPoints,
      kills: item.stats?.kills || 0,
      damage: item.stats?.damage || 0,
      tank: item.stats?.survivalTime || 0,
      tierScore: controlPoints + autoPoints,
    };
  });
  return {
    kills: [...base].sort((a, b) => b.kills - a.kills),
    damage: [...base].sort((a, b) => b.damage - a.damage),
    tank: [...base].sort((a, b) => b.tank - a.tank),
    tier: [...base].sort((a, b) => b.tierScore - a.tierScore),
  };
};

export const makePublicProfile = (player) => {
  const enriched = enrichPlayer(player);
  return {
    playerId: player.id,
    nickname: player.nickname,
    title: player.title,
    acquiredTitles: player.acquiredTitles || {},
    logoText: player.logoText,
    gold: player.gold,
    activeCharacterId: player.activeCharacterId,
    autoSquad: player.autoSquad || [],
    ownedCharacterCount: Object.keys(player.ownedCharacters || {}).length,
    ownedItemCount: Object.values(player.items || {}).reduce((sum, item) => sum + (item.count || 0), 0),
    ownedCharacters: player.ownedCharacters || {},
    equippedItems: player.equippedItems || {},
    teamValue: enriched.teamValue || 0,
    stats: player.stats || buildDefaultStats(),
    online: true,
    lastActiveAt: nowIso(),
    updatedAt: nowIso(),
  };
};

export const buildRoom = ({ hostUid, hostPlayerId, hostNickname, mode, wager = 0 }) => ({
  id: uid('room'),
  mode,
  wager: Number(wager) || 0,
  hostUid,
  hostPlayerId,
  hostNickname,
  guestUid: null,
  guestPlayerId: null,
  guestNickname: null,
  status: '대기중',
  createdAt: nowIso(),
});



export const getTeamPower = (player = {}) => {
  const ids = new Set([
    player.activeCharacterId,
    ...((player.autoSquad || []).slice(0, 2)),
  ].filter(Boolean));
  return [...ids].reduce((sum, id) => sum + getCharacterPower(player, id), 0);
};


export const equipItemToCharacter = (player, itemId, characterId = player.activeCharacterId) => {
  if (!player?.ownedCharacters?.[characterId]) return { ok: false, reason: '보유하지 않은 캐릭터입니다.' };
  if (!player?.items?.[itemId] || (player.items[itemId].count || 0) <= 0) return { ok: false, reason: '보유하지 않은 아이템입니다.' };
  player.equippedItems = player.equippedItems || {};
  const current = player.equippedItems[characterId] || [];
  if (current.includes(itemId)) return { ok: false, reason: '이미 장착한 아이템입니다.' };
  if (current.length >= 2) return { ok: false, reason: '캐릭터마다 아이템은 최대 2개까지만 장착할 수 있습니다.' };
  player.equippedItems[characterId] = [...current, itemId];
  player.updatedAt = nowIso();
  return { ok: true };
};

export const unequipItemFromCharacter = (player, itemId, characterId = player.activeCharacterId) => {
  player.equippedItems = player.equippedItems || {};
  const current = player.equippedItems[characterId] || [];
  player.equippedItems[characterId] = current.filter((id) => id !== itemId);
  player.updatedAt = nowIso();
  return { ok: true };
};

const resolveItemFromPlayer = (player = {}, id) => (player.customItems?.[id] || ITEM_MAP[id] || { id, name: id });

export const getEquippedItemObjects = (player = {}, characterId = player.activeCharacterId) => (player.equippedItems?.[characterId] || [])
  .map((id) => ({ ...resolveItemFromPlayer(player, id), id }))
  .filter(Boolean);

export const getEquipmentStats = (player = {}, characterId = player.activeCharacterId) => getEquippedItemObjects(player, characterId).reduce((acc, item) => {
  const stats = item.stats || {};
  acc.hp += stats.hp || 0;
  acc.attack += stats.attack || 0;
  acc.attackSpeed += stats.attackSpeed || 0;
  acc.speed += stats.speed || 0;
  acc.critChance += stats.critChance || 0;
  return acc;
}, { hp: 0, attack: 0, attackSpeed: 0, speed: 0, critChance: 0 });

export const getOwnedItemObjects = (player = {}) => Object.entries(player.items || {}).map(([id, data]) => ({
  ...resolveItemFromPlayer(player, id),
  id,
  count: data?.count || 0,
  data,
})).filter((item) => item.count > 0);



export const craftFlexibleCustomItem = (player, { effectA, effectB, name } = {}) => {
  player.inventory = player.inventory || {};
  player.inventory.customMaterials = player.inventory.customMaterials || 0;
  player.items = player.items || {};
  player.customItems = player.customItems || {};

  const first = CUSTOM_MATERIAL_EFFECTS[effectA];
  const second = CUSTOM_MATERIAL_EFFECTS[effectB];
  if (!first || !second) return { ok: false, reason: '선택한 효과를 찾을 수 없습니다.' };

  const effects = effectA === effectB ? [effectA] : [effectA, effectB];
  const materialCost = Math.max(3, first.materialCost + second.materialCost - (effectA === effectB ? 1 : 0));
  if (player.inventory.customMaterials < materialCost) return { ok: false, reason: `커스텀 재료가 부족합니다. 필요 재료: ${materialCost}개` };

  const stats = { hp: 0, attack: 0, attackSpeed: 0, speed: 0, critChance: 0 };
  [first.stats, second.stats].forEach((src) => {
    Object.keys(stats).forEach((key) => { stats[key] += src?.[key] || 0; });
  });

  const id = `custom_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  const item = {
    id,
    name: String(name || `${first.label} + ${second.label}`).slice(0, 18),
    rarity: '커스텀',
    materialCost,
    stats,
    effects,
    description: `${first.label}: ${first.description} / ${second.label}: ${second.description}`,
    createdAt: nowIso(),
  };

  player.inventory.customMaterials -= materialCost;
  player.customItems[id] = JSON.parse(JSON.stringify(item));
  player.items[id] = { count: 1, source: 'customCraft', createdAt: nowIso() };
  player.updatedAt = nowIso();
  return { ok: true, item };
};

export const craftCustomItem = (player, recipeId) => {
  player.inventory = player.inventory || {};
  player.inventory.customMaterials = player.inventory.customMaterials || 0;
  player.items = player.items || {};
  player.customItems = player.customItems || {};
  const recipe = CUSTOM_ITEM_RECIPES.find((item) => item.id === recipeId);
  if (!recipe) return { ok: false, reason: '존재하지 않는 커스텀 아이템입니다.' };
  if (player.inventory.customMaterials < recipe.materialCost) return { ok: false, reason: '커스텀 재료가 부족합니다.' };
  player.inventory.customMaterials -= recipe.materialCost;
  player.customItems[recipe.id] = JSON.parse(JSON.stringify(recipe));
  player.items[recipe.id] = {
    count: (player.items?.[recipe.id]?.count || 0) + 1,
    source: 'customCraft',
  };
  player.updatedAt = nowIso();
  return { ok: true, item: recipe };
};


export const getComparableStats = (character) => ({
  hp: character?.baseStats?.hp || 0,
  attack: character?.baseStats?.attack || 0,
  attackSpeed: character?.baseStats?.attackSpeed || 0,
  speed: character?.baseStats?.speed || 0,
  critChance: character?.baseStats?.critChance || 0,
});

export const getStatLabel = (key) => ({
  hp: '체력',
  attack: '공격력',
  attackSpeed: '공격속도',
  speed: '스피드',
  critChance: '치명타확률',
}[key] || key);

export const randomRange = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

export const clone = (value) => JSON.parse(JSON.stringify(value));
