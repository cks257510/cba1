import { mountLiveBattle } from './battle/liveBattle.js';
import { mountAdventureMode } from './adventure/adventureMode.js';
import { playLobbyMusic, playBattleMusic, setGameVolume, stopAllMusic } from './services/audioService.js';
import { APP_CONFIG } from './config.js';
import { CHARACTER_LIST, getRandomCharacterId } from './data/characters.js';
import { render, renderModal } from './ui/render.js';
import {
  initFirebase,
  isFirebaseReady,
  watchAuth,
  signUpWithEmail,
  signInWithEmail,
  signOutUser,
  bootstrapAfterLogin,
  createPlayer as createPlayerRemote,
  setActivePlayerId,
  updatePlayer as updatePlayerRemote,
  deletePlayer as deletePlayerRemote,
  watchRooms,
  fetchRoom,
  watchRoom,
  createRoom as createRoomRemote,
  updateRoom as updateRoomRemote,
  removeRoom as removeRoomRemote,
  watchPublicProfiles,
  updatePublicPresence,
  watchGlobalChat,
  sendGlobalChat,
  getFriendlyAuthErrorMessage,
} from './services/firebaseService.js';
import {
  clone,
  enrichPlayer,
  openCharacterPack,
  buyCharacter,
  enhanceCharacter,
  simulateRankedMatch,
  simulateProfileChallenge,
  simulateDungeon,
  claimMission,
  buildRoom,
  grantCharacter,
  openItemPack,
  equipItemToCharacter,
  unequipItemFromCharacter,
  craftCustomItem,
  craftFlexibleCustomItem,
  CUSTOM_ITEM_RECIPES,
} from './services/gameService.js';

const appRoot = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');
const toastRoot = document.getElementById('toast-root');

const state = {
  screen: 'loading',
  user: null,
  userMeta: null,
  players: {},
  activePlayer: null,
  authError: '',
  form: { email: '', password: '' },
  modal: null,
  lobbyTab: 'main',
  rooms: {},
  publicProfiles: {},
  resourceStatus: '',
  resourceLoading: false,
  previewMode: 'control',
  liveBattleMode: 'control',
  returnLobbyTab: 'main',
  activeRoomId: null,
  activeRoom: null,
  activeRoomMode: 'control',
  battleHasResult: false,
  battleForfeitSaved: false,
  battleResultShown: false,
  chatMessages: {},
  compareSelection: [],
};

let unwatchRooms = null;
let unwatchProfiles = null;
let unwatchChat = null;
let presenceTimer = null;
let unwatchActiveRoom = null;
let renderScheduled = false;
let liveBattleCleanup = null;
let adventureCleanup = null;

const scheduleRender = () => {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;

    if (state.screen === 'liveBattle' && liveBattleCleanup) {
      if (state.activePlayer?.settings) setGameVolume(state.activePlayer.settings.volume ?? APP_CONFIG.defaultVolume ?? 0.3);
      modalRoot.innerHTML = renderModal(state.modal, state);
      return;
    }
    if (state.screen === 'adventureMode' && adventureCleanup) {
      modalRoot.innerHTML = renderModal(state.modal, state);
      return;
    }

    const prevScreen = state.screen;
    const prevLobbyTab = state.lobbyTab;
    const prevContentScroll = appRoot.querySelector('.content-panel')?.scrollTop || 0;
    const prevSideScroll = appRoot.querySelector('.side-nav')?.scrollTop || 0;

    if (liveBattleCleanup) {
      liveBattleCleanup();
      liveBattleCleanup = null;
    }
    if (adventureCleanup) {
      adventureCleanup();
      adventureCleanup = null;
    }
    appRoot.innerHTML = render(state);
    modalRoot.innerHTML = renderModal(state.modal, state);

    if (state.screen === 'lobby' && prevScreen === 'lobby' && prevLobbyTab === state.lobbyTab) {
      const nextContent = appRoot.querySelector('.content-panel');
      const nextSide = appRoot.querySelector('.side-nav');
      if (nextContent) nextContent.scrollTop = prevContentScroll;
      if (nextSide) nextSide.scrollTop = prevSideScroll;
    }

    if (state.activePlayer?.settings) setGameVolume(state.activePlayer.settings.volume ?? APP_CONFIG.defaultVolume ?? 0.3);
    if (state.screen === 'liveBattle') {
      playBattleMusic();
      const root = document.getElementById('live-battle-root');
      if (root) {
        liveBattleCleanup = mountLiveBattle({
          root: document,
          mode: state.liveBattleMode || 'control',
          player: state.activePlayer,
          room: state.activeRoom,
          user: state.user,
          onExit: () => handleExitLiveBattle(),
          onResult: (result) => handleLiveBattleResult(result),
        });
      }
    } else if (state.screen === 'adventureMode') {
      playLobbyMusic();
      adventureCleanup = mountAdventureMode({
        root: document,
        player: state.activePlayer,
        user: state.user,
        onExit: () => {
          if (adventureCleanup) { adventureCleanup(); adventureCleanup = null; }
          state.screen = 'lobby';
          state.lobbyTab = 'adventure';
          scheduleRender();
        },
        onToast: showToast,
      });
    } else if (state.screen === 'lobby' || state.screen === 'prep') {
      playLobbyMusic();
    } else {
      stopAllMusic();
    }
  });
};

const showToast = (message, type = 'info') => {
  const wrap = toastRoot.querySelector('.toast-wrap') || (() => {
    const el = document.createElement('div');
    el.className = 'toast-wrap';
    toastRoot.appendChild(el);
    return el;
  })();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  wrap.appendChild(toast);
  setTimeout(() => toast.remove(), 3400);
};

const setState = (patch) => {
  Object.assign(state, patch);
  scheduleRender();
};

const setScreen = (screen) => setState({ screen, authError: '' });
const closeModal = () => setState({ modal: null });


const getRankedWinGoldForMode = (player, mode) => {
  const points = mode === 'auto' ? player.stats?.rankedPointsAuto || 0 : player.stats?.rankedPointsControl || 0;
  return points >= 100 ? 80 : 50;
};




const forceBattleCleanup = () => {
  if (liveBattleCleanup) {
    try { liveBattleCleanup(); } catch (error) { console.warn(error); }
    liveBattleCleanup = null;
  }
};




const normalizeLoadedPlayer = (player) => {
  if (!player) return player;
  player.inventory = player.inventory || {};
  player.inventory.characterPacks = player.inventory.characterPacks || 0;
  player.inventory.basicItemPacks = player.inventory.basicItemPacks || 0;
  player.inventory.epicItemPacks = player.inventory.epicItemPacks || 0;
  player.inventory.boostStones = player.inventory.boostStones || 0;
  player.inventory.titleCoupons = player.inventory.titleCoupons || 0;
  player.inventory.customMaterials = player.inventory.customMaterials || 0;
  player.items = player.items || {};
  player.customItems = player.customItems || {};
  player.equippedItems = player.equippedItems || {};
  player.stats = player.stats || {};
  player.ownedCharacters = player.ownedCharacters || {};
  player.meta = player.meta || {};
  player.settings = player.settings || { volume: APP_CONFIG.defaultVolume || 0.3 };
  if (typeof player.settings.volume !== 'number') player.settings.volume = APP_CONFIG.defaultVolume || 0.3;
  return player;
};



const requirePlayer = () => {
  if (!state.activePlayer) {
    showToast('활성 플레이어를 먼저 선택하세요.', 'error');
    return false;
  }
  return true;
};

const persistActivePlayer = async () => {
  if (!state.user || !state.activePlayer) return;
  normalizeLoadedPlayer(state.activePlayer);
  const saved = await updatePlayerRemote(state.user.uid, state.activePlayer);
  await updatePublicPresence(state.user.uid, saved).catch(() => {});
  state.players[saved.id] = saved;
  state.activePlayer = saved;
  scheduleRender();
};

const mutateActivePlayer = async (mutator, successMessage = '') => {
  if (!requirePlayer()) return;
  const draft = clone(state.activePlayer);
  const result = await mutator(draft);
  state.activePlayer = draft;
  state.players[draft.id] = draft;
  await persistActivePlayer();
  if (successMessage) showToast(successMessage, 'success');
  return result;
};

const startRealtimeWatchers = () => {
  if (unwatchRooms) unwatchRooms();
  if (unwatchProfiles) unwatchProfiles();
  unwatchRooms = watchRooms((rooms) => {
    const incomingRooms = rooms || {};
    const clearKey = 'characterBrawlRoomsClearedV27';
    if (!localStorage.getItem(clearKey) && Object.keys(incomingRooms).length) {
      Object.keys(incomingRooms).forEach((roomId) => removeRoomRemote(roomId).catch(() => {}));
      localStorage.setItem(clearKey, '1');
      state.rooms = {};
    } else {
      state.rooms = Object.fromEntries(Object.entries(incomingRooms).filter(([, room]) => room?.status !== '종료'));
    }
    scheduleRender();
  });
  unwatchProfiles = watchPublicProfiles((profiles) => {
    state.publicProfiles = profiles || {};
    scheduleRender();
  });
  if (unwatchChat) unwatchChat();
  if (unwatchActiveRoom) unwatchActiveRoom();
  unwatchChat = watchGlobalChat((messages) => {
    state.chatMessages = messages || {};
    scheduleRender();
  });
};

const bootstrapUser = async (user) => {
  const { meta, players } = await bootstrapAfterLogin(user);
  state.user = user;
  state.userMeta = meta || null;
  state.players = Object.fromEntries(Object.entries(players || {}).map(([id, player]) => [id, normalizeLoadedPlayer(player)]));
  state.activePlayer = meta?.activePlayerId ? state.players?.[meta.activePlayerId] || null : Object.values(state.players || {})[0] || null;
  normalizeLoadedPlayer(state.activePlayer);
  state.lobbyTab = state.activePlayer?.meta?.lastViewedTab || 'main';
  startRealtimeWatchers();
  if (presenceTimer) clearInterval(presenceTimer);
  if (state.activePlayer) {
    updatePublicPresence(state.user.uid, state.activePlayer).catch(() => {});
    presenceTimer = setInterval(() => {
      if (state.user && state.activePlayer) updatePublicPresence(state.user.uid, state.activePlayer).catch(() => {});
    }, 30000);
  }
  setScreen(state.activePlayer ? 'prep' : 'playerSelect');
};

const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) throw new Error('이 브라우저는 Service Worker를 지원하지 않습니다.');
  state.resourceLoading = true;
  state.resourceStatus = '리소스 다운로드를 준비하는 중입니다...';
  scheduleRender();
  await navigator.serviceWorker.register('./service-worker.js');
  const assetUrls = [
    './assets/skins/',
    './assets/skills/',
  ];
  await Promise.all(assetUrls.map((url) => fetch(url, { method: 'GET' }).catch(() => null)));
  state.resourceLoading = false;
  state.resourceStatus = '앱 셸과 주요 리소스 캐시가 준비되었습니다.';
  scheduleRender();
};

const handleAuthSubmit = async (mode) => {
  const email = document.getElementById('auth-email')?.value?.trim();
  const password = document.getElementById('auth-password')?.value;
  state.form = { email, password };
  if (!email || !password) {
    setState({ authError: '이메일과 비밀번호를 모두 입력해주세요.' });
    return;
  }
  try {
    if (mode === 'signup') await signUpWithEmail(email, password);
    else await signInWithEmail(email, password);
    state.authError = '';
  } catch (error) {
    setState({ authError: getFriendlyAuthErrorMessage(error) });
  }
};


const handleCreatePlayer = async () => {
  const nickname = document.getElementById('new-player-name')?.value?.trim();
  if (!nickname) return showToast('닉네임을 입력해주세요.', 'error');
  if (nickname.length < APP_CONFIG.nicknameMin || nickname.length > APP_CONFIG.nicknameMax) {
    return showToast(`닉네임은 ${APP_CONFIG.nicknameMin}~${APP_CONFIG.nicknameMax}글자여야 합니다.`, 'error');
  }
  const duplicate = Object.values(state.publicProfiles || {}).some((profile) => String(profile?.nickname || '').trim().toLowerCase() === nickname.toLowerCase());
  if (duplicate) return showToast('이미 사용 중인 닉네임입니다.', 'error');
  try {
    const player = await createPlayerRemote(state.user.uid, nickname);
    normalizeLoadedPlayer(player);
    state.players[player.id] = player;
    state.activePlayer = player;
    setScreen('prep');
  } catch (error) {
    console.error(error);
    showToast(error.message || '플레이어 생성에 실패했습니다.', 'error');
  }
};

const handleSelectPlayer = async (playerId) => {
  const player = normalizeLoadedPlayer(state.players[playerId]);
  if (!player) return;
  state.activePlayer = player;
  await setActivePlayerId(state.user.uid, playerId);
  showToast(`${player.nickname} 플레이어를 선택했습니다.`, 'success');
  setScreen('prep');
};

const handleDeletePlayer = async (playerId) => {
  const password = document.getElementById('delete-player-password')?.value || '';
  if (!password) {
    showToast('비밀번호를 입력해주세요.', 'error');
    return;
  }
  try {
    Object.values(state.rooms || {}).forEach((room) => {
      if (room?.hostPlayerId === playerId) removeRoomRemote(room.id).catch(() => {});
      else if (room?.guestPlayerId === playerId) updateRoomRemote(room.id, {
        guestUid: null,
        guestPlayerId: null,
        guestNickname: null,
        guestReady: false,
        guestCharacterId: null,
        status: '대기중',
      }).catch(() => {});
    });
    await deletePlayerRemote({ uid: state.user.uid, playerId, email: state.user.email, password });
    delete state.players[playerId];
    const nextPlayer = Object.values(state.players)[0] || null;
    state.activePlayer = nextPlayer;
    closeModal();
    showToast('플레이어가 삭제되었습니다.', 'success');
    setScreen(nextPlayer ? 'playerSelect' : 'playerSelect');
  } catch (error) {
    showToast(getFriendlyAuthErrorMessage(error), 'error');
  }
};

const openDevMode = async () => {
  const pin = document.getElementById('dev-pin')?.value?.trim();
  if (pin !== APP_CONFIG.devPin) {
    showToast('인증 코드가 올바르지 않습니다.', 'error');
    return;
  }
  await mutateActivePlayer((player) => {
    player.devModeEnabled = true;
  }, '개발자 모드가 활성화되었습니다.');
  closeModal();
};

const disableDevMode = async () => {
  await mutateActivePlayer((player) => {
    player.devModeEnabled = false;
  }, '개발자 모드를 비활성화했습니다.');
};

const handleDevAdjust = async (field, value) => {
  if (!state.activePlayer?.devModeEnabled) return;
  await mutateActivePlayer((player) => {
    if (field === 'gold') player.gold += Number(value);
    else player.stats[field] = (player.stats[field] || 0) + Number(value);
  }, `${field} 값이 조정되었습니다.`);
};

const handleDevUnlockAll = async () => {
  if (!state.activePlayer?.devModeEnabled) return;
  await mutateActivePlayer((player) => {
    CHARACTER_LIST.forEach((character) => grantCharacter(player, character.id));
  }, '모든 캐릭터가 해금되었습니다.');
};

const handleDevResetPoints = async () => {
  await mutateActivePlayer((player) => {
    player.stats.rankedPointsControl = 0;
    player.stats.rankedPointsAuto = 0;
  }, '랭크 포인트를 초기화했습니다.');
};




const handleCraftFreeCustomItem = async () => {
  if (!requirePlayer()) return;
  const effectA = document.getElementById('custom-effect-a')?.value || 'teleportPlus';
  const effectB = document.getElementById('custom-effect-b')?.value || 'attackSpeedPlus';
  const name = document.getElementById('custom-item-name')?.value?.trim();
  await mutateActivePlayer((player) => {
    const result = craftFlexibleCustomItem(player, { effectA, effectB, name });
    if (!result.ok) throw new Error(result.reason);
  }, '커스텀 아이템 제작 완료');
};

const handleCraftCustomItem = async (recipeId) => {
  if (!requirePlayer()) return;
  const recipe = CUSTOM_ITEM_RECIPES.find((item) => item.id === recipeId);
  if (!recipe) return showToast('레시피를 찾을 수 없습니다.', 'error');
  await mutateActivePlayer((player) => {
    const result = craftCustomItem(player, recipeId);
    if (!result.ok) throw new Error(result.reason);
  }, `${recipe.name} 제작 완료`);
};

const handleBuyItemPack = async (packType) => {
  let packResult;
  await mutateActivePlayer((player) => {
    packResult = openItemPack(player, packType);
    if (!packResult.ok) throw new Error(packResult.reason);
  });
  setState({ modal: { type: 'itemPackResult', item: packResult.item, pack: packResult.pack } });
  showToast(`${packResult.item.name} 획득!`, 'success');
};

const handleOpenItemPackContents = (packType) => {
  setState({ modal: { type: 'itemPackContents', packType } });
};

const handleBuyPack = async () => {
  let packResult;
  await mutateActivePlayer((player) => {
    packResult = openCharacterPack(player);
    if (!packResult.ok) throw new Error(packResult.reason);
  });
  setState({ modal: { type: 'packResult', character: packResult.character } });
  showToast(`${packResult.character.name} 획득!`, 'success');
};

const handleBuyCharacter = async (characterId) => {
  await mutateActivePlayer((player) => {
    const result = buyCharacter(player, characterId);
    if (!result.ok) throw new Error(result.reason);
  }, '캐릭터를 구매했습니다.');
};

const handleSetActiveCharacter = async (characterId) => {
  await mutateActivePlayer((player) => {
    if (!player.ownedCharacters?.[characterId]) throw new Error('보유하지 않은 캐릭터입니다.');
    player.activeCharacterId = characterId;
  }, '컨트롤 대표 캐릭터를 변경했습니다.');
};

const handleToggleAutoSquad = async (characterId) => {
  await mutateActivePlayer((player) => {
    player.autoSquad = player.autoSquad || [];
    if (player.autoSquad.includes(characterId)) {
      player.autoSquad = player.autoSquad.filter((id) => id !== characterId);
    } else if (player.autoSquad.length < 2) {
      player.autoSquad.push(characterId);
    } else {
      throw new Error('오토 스쿼드는 최대 2명까지 설정할 수 있습니다.');
    }
  }, '오토 스쿼드를 수정했습니다.');
};

const handleEnhanceCharacter = async (characterId) => {
  let result;
  await mutateActivePlayer((player) => {
    result = enhanceCharacter(player, characterId);
    if (!result.ok) throw new Error(result.reason);
  });
  showToast(result.success ? `강화 성공! 현재 +${result.enhancement}` : `강화 실패... (성공률 ${result.rate}%)`, result.success ? 'success' : 'error');
};

const handleSimulateRanked = async (mode) => {
  let result;
  await mutateActivePlayer((player) => {
    result = simulateRankedMatch(player, mode);
  });
  showToast(`${mode === 'control' ? '컨트롤' : '오토'} 경쟁전 ${result.win ? '승리' : '패배'} · 포인트 ${result.pointsDelta > 0 ? '+' : ''}${result.pointsDelta}`, result.win ? 'success' : 'error');
  state.lobbyTab = mode === 'control' ? 'controlHub' : 'autoHub';
  scheduleRender();
};

const handleSimulateChallenge = async () => {
  let result;
  await mutateActivePlayer((player) => {
    result = simulateProfileChallenge(player);
    if (!result.ok) throw new Error(result.reason);
  });
  showToast(result.win ? `도전 승리! ${result.rewardGold}골드를 받았습니다.` : '도전에 패배했습니다.', result.win ? 'success' : 'error');
};

const handleSimulateDungeon = async () => {
  let result;
  await mutateActivePlayer((player) => {
    result = simulateDungeon(player);
    if (!result.ok) throw new Error(result.reason);
  });
  showToast(result.win ? `던전 클리어! ${result.rewardGold}골드 획득` : '던전에서 패배했습니다.', result.win ? 'success' : 'error');
};

const handleClaimMission = async (missionId) => {
  await mutateActivePlayer((player) => {
    const result = claimMission(player, missionId);
    if (!result.ok) throw new Error(result.reason);
  }, '미션 보상을 수령했습니다.');
};


const handleCreateRoom = async (mode) => {
  const wager = Number(document.getElementById('room-wager')?.value || 0);
  const bossType = document.getElementById('room-boss-type')?.value || 'diablo';
  const room = buildRoom({
    hostUid: state.user.uid,
    hostPlayerId: state.activePlayer.id,
    hostNickname: state.activePlayer.nickname,
    mode,
    wager,
  });
  room.hostCharacterId = state.activePlayer.activeCharacterId;
  room.guestReady = false;
  if (mode === 'raidCoop') room.bossType = bossType;
  await createRoomRemote(room);
  closeModal();
  showToast(mode === 'raidCoop' ? '협동 레이드방이 생성되었습니다.' : '경기방이 생성되었습니다.', 'success');
};

const handleJoinRoom = async (roomId) => handleEnterRoomLobby(roomId);

const handleDeleteRoom = async (roomId) => {
  const room = await fetchRoom(roomId);
  if (!room) return showToast('방을 찾을 수 없습니다.', 'error');
  if (room.hostPlayerId !== state.activePlayer?.id) return showToast('방을 만든 플레이어만 삭제할 수 있습니다.', 'error');
  await removeRoomRemote(roomId);
  showToast('방이 삭제되었습니다.', 'success');
};



const openRoomLobbyModal = async (roomId) => {
  let room = await fetchRoom(roomId);
  if (!room) return showToast('방을 찾을 수 없습니다.', 'error');

  state.activeRoomId = roomId;
  state.activeRoom = room;
  state.activeRoomMode = room.mode || 'control';

  if (unwatchActiveRoom) unwatchActiveRoom();
  unwatchActiveRoom = watchRoom(roomId, (updatedRoom) => {
    state.activeRoom = updatedRoom;
    if (!updatedRoom) {
      state.modal = null;
      scheduleRender();
      return;
    }

    if (state.modal?.type === 'friendlyRoomLobby') {
      state.modal.room = updatedRoom;
      scheduleRender();
    }

    const myPlayerId = state.activePlayer?.id;
    const isParticipant = updatedRoom.hostPlayerId === myPlayerId || updatedRoom.guestPlayerId === myPlayerId;
    if (updatedRoom.status === '전투중' && state.screen !== 'liveBattle' && isParticipant) {
      state.liveBattleMode = updatedRoom.mode === 'raidCoop' ? 'raidCoop' : 'friendly';
      state.returnLobbyTab = updatedRoom.mode === 'auto' ? 'autoRooms' : updatedRoom.mode === 'raidCoop' ? 'raidRooms' : 'controlRooms';
      state.activeRoomId = roomId;
      state.activeRoom = updatedRoom;
      state.activeRoomMode = updatedRoom.mode || state.activeRoomMode || 'control';
      state.battleHasResult = false;
      state.battleForfeitSaved = false;
      state.battleResultShown = false;
      state.modal = null;
      setScreen('liveBattle');
    }
  });

  setState({ modal: { type: 'friendlyRoomLobby', room } });
};

const handleEnterRoomLobby = async (roomId) => {
  let room = await fetchRoom(roomId);
  if (!room) return showToast('방을 찾을 수 없습니다.', 'error');

  const myPlayerId = state.activePlayer?.id;
  const isHost = room.hostPlayerId === myPlayerId;
  const isGuest = room.guestPlayerId === myPlayerId;

  if (!isHost && room.guestPlayerId && !isGuest) {
    return showToast('이미 다른 게스트가 입장했습니다.', 'error');
  }

  if (!isHost && !room.guestPlayerId) {
    await updateRoomRemote(roomId, {
      guestUid: state.user.uid,
      guestPlayerId: state.activePlayer.id,
      guestNickname: state.activePlayer.nickname,
      guestReady: false,
      guestCharacterId: state.activePlayer.activeCharacterId,
      status: '준비중',
    });
    room = await fetchRoom(roomId);
  }

  if (isHost && !room.hostCharacterId) {
    await updateRoomRemote(roomId, {
      hostCharacterId: state.activePlayer.activeCharacterId,
    });
    room = await fetchRoom(roomId);
  }

  await openRoomLobbyModal(roomId);
};

const handleSelectRoomCharacter = async (roomId, characterId) => {
  const room = await fetchRoom(roomId);
  if (!room) return showToast('방을 찾을 수 없습니다.', 'error');
  if (!state.activePlayer?.ownedCharacters?.[characterId]) return showToast('보유하지 않은 캐릭터입니다.', 'error');

  const myPlayerId = state.activePlayer?.id;
  if (room.hostPlayerId === myPlayerId) {
    await updateRoomRemote(roomId, { hostCharacterId: characterId });
  } else if (room.guestPlayerId === myPlayerId) {
    await updateRoomRemote(roomId, { guestCharacterId: characterId, guestReady: false });
  } else {
    showToast('이 방에 입장한 플레이어가 아닙니다.', 'error');
  }
};

const handleGuestReadyRoom = async (roomId) => {
  const room = await fetchRoom(roomId);
  if (!room) return showToast('방을 찾을 수 없습니다.', 'error');
  if (room.guestPlayerId !== state.activePlayer?.id) return showToast('게스트만 준비완료를 누를 수 있습니다.', 'error');
  if (!room.guestCharacterId) return showToast('캐릭터를 먼저 선택하세요.', 'error');
  await updateRoomRemote(roomId, { guestReady: true });
  showToast('준비완료', 'success');
};

const handleHostStartRoomBattle = async (roomId, mode) => {
  const room = await fetchRoom(roomId);
  if (!room) return showToast('방을 찾을 수 없습니다.', 'error');
  if (room.hostPlayerId !== state.activePlayer?.id) return showToast('호스트만 시작할 수 있습니다.', 'error');
  if (!room.guestPlayerId) return showToast('상대가 아직 입장하지 않았습니다.', 'error');
  if (!room.guestReady) return showToast('상대방이 준비하지 않았습니다.', 'error');
  if (!room.hostCharacterId) return showToast('캐릭터를 먼저 선택하세요.', 'error');
  if (!room.guestCharacterId) return showToast('상대방이 캐릭터를 선택하지 않았습니다.', 'error');

  const updated = {
    status: '전투중',
    startedAt: new Date().toISOString(),
    battleSeed: Date.now(),
    battleInputs: null,
    winnerPlayerId: null,
    loserPlayerId: null,
    settledAt: null,
  };
  await updateRoomRemote(roomId, updated);

  state.activeRoomId = roomId;
  state.activeRoom = { ...room, ...updated };
  state.liveBattleMode = mode === 'raidCoop' ? 'raidCoop' : 'friendly';
  state.returnLobbyTab = mode === 'auto' ? 'autoRooms' : mode === 'raidCoop' ? 'raidRooms' : 'controlRooms';
  state.battleHasResult = false;
  state.battleForfeitSaved = false;
  closeModal();
  setScreen('liveBattle');
};

const handleStartRoomBattle = async (roomId, mode) => handleHostStartRoomBattle(roomId, mode);


const handleSendChat = async () => {
  if (!requirePlayer()) return;
  const input = document.getElementById('global-chat-input');
  const message = input?.value?.trim();
  if (!message) return;
  await sendGlobalChat({
    uid: state.user.uid,
    playerId: state.activePlayer.id,
    nickname: state.activePlayer.nickname,
    message,
  });
  state.activePlayer.stats.chatMessages = (state.activePlayer.stats.chatMessages || 0) + 1;
  await persistActivePlayer();
  if (input) input.value = '';
};

const handleOpenPlayerInfo = (profileKey) => {
  const profile = state.publicProfiles?.[profileKey];
  if (!profile) return showToast('플레이어 정보를 찾을 수 없습니다.', 'error');
  setState({ modal: { type: 'playerInfo', profileKey, profile } });
};

const handleOpenCharacterInfo = (characterId) => {
  setState({ modal: { type: 'characterInfo', characterId } });
};

const handleToggleCompare = (characterId) => {
  const current = state.compareSelection || [];
  if (current.includes(characterId)) {
    state.compareSelection = current.filter((id) => id !== characterId);
  } else {
    if (current.length >= 3) {
      showToast('비교는 최대 3명까지 가능합니다.', 'error');
      return;
    }
    state.compareSelection = [...current, characterId];
  }
  scheduleRender();
};

const handleOpenCompare = () => {
  if (!state.compareSelection?.length) {
    showToast('비교할 캐릭터를 먼저 선택하세요.', 'error');
    return;
  }
  setState({ modal: { type: 'compareCharacters', characterIds: state.compareSelection } });
};



const handleBattleForfeit = async () => {
  if (!state.activePlayer || !state.user) return;
  try {
    const player = clone(state.activePlayer);
    normalizeLoadedPlayer(player);
    const mode = state.liveBattleMode || 'control';
    player.stats.totalMatches = (player.stats.totalMatches || 0) + 1;
    player.stats.rankedLosses = (player.stats.rankedLosses || 0) + 1;

    if (mode === 'auto' || mode === 'dungeon') {
      player.stats.rankedPointsAuto = Math.max(0, (player.stats.rankedPointsAuto || 0) - 6);
    } else {
      player.stats.rankedPointsControl = Math.max(0, (player.stats.rankedPointsControl || 0) - 6);
    }

    if (mode === 'friendly') {
      await applyFriendlyWagerResult(player, { mode: 'friendly', win: false });
    }

    const saved = await updatePlayerRemote(state.user.uid, player);
    await updatePublicPresence(state.user.uid, saved).catch(() => {});
    state.players[saved.id] = saved;
    state.activePlayer = saved;
    if (state.activeRoomId && mode !== 'friendly') {
      await updateRoomRemote(state.activeRoomId, {
        status: '종료',
        loserUid: state.user.uid,
        loserPlayerId: player.id,
        endedAt: new Date().toISOString(),
      }).catch(() => {});
    }
    showToast('나가기 버튼으로 패배 처리되었습니다. 포인트가 차감되었습니다.', 'error');
  } catch (error) {
    console.error(error);
  }
};

const handleExitLiveBattle = async () => {
  if (state.screen === 'liveBattle' && !state.battleHasResult && !state.battleForfeitSaved) {
    state.battleForfeitSaved = true;
    await handleBattleForfeit();
  }
  forceBattleCleanup();
  state.modal = null;
  state.lobbyTab = state.returnLobbyTab || 'main';
  state.screen = 'lobby';
  appRoot.innerHTML = '';
  scheduleRender();
};


const handleSaveSettings = async () => {
  const volume = Number(document.getElementById('settings-volume')?.value ?? 0.5);
  const nickname = document.getElementById('settings-nickname')?.value?.trim() || state.activePlayer?.nickname || '';
  if (nickname.length < APP_CONFIG.nicknameMin || nickname.length > APP_CONFIG.nicknameMax) {
    showToast(`닉네임은 ${APP_CONFIG.nicknameMin}~${APP_CONFIG.nicknameMax}글자여야 합니다.`, 'error');
    return;
  }
  const myKey = `${state.user.uid}_${state.activePlayer?.id}`;
  const duplicate = Object.entries(state.publicProfiles || {}).some(([key, profile]) => key !== myKey && String(profile?.nickname || '').trim().toLowerCase() === nickname.toLowerCase());
  if (duplicate) {
    showToast('이미 사용 중인 닉네임입니다.', 'error');
    return;
  }
  await mutateActivePlayer((player) => {
    player.nickname = nickname;
    player.logoText = nickname.slice(0, 2).toUpperCase();
    player.settings = player.settings || {};
    player.settings.volume = volume;
  }, '설정이 저장되었습니다.');
  setGameVolume(volume);
  closeModal();
};

const handleLeaveRoom = async (roomId) => {
  const room = state.rooms?.[roomId] || await fetchRoom(roomId);
  if (!room) return;
  if (room.hostPlayerId === state.activePlayer?.id) {
    await removeRoomRemote(roomId);
  } else if (room.guestPlayerId === state.activePlayer?.id) {
    await updateRoomRemote(roomId, { guestUid: null, guestPlayerId: null, guestNickname: null, guestReady: false, guestCharacterId: null, status: '대기중' });
  }
  showToast('방에서 나갔습니다.', 'success');
};

const handleDownloadResources = async () => {
  try {
    await registerServiceWorker();
    showToast('리소스 캐시가 준비되었습니다.', 'success');
  } catch (error) {
    state.resourceLoading = false;
    state.resourceStatus = error.message || '리소스 다운로드에 실패했습니다.';
    scheduleRender();
    showToast(state.resourceStatus, 'error');
  }
};

const handleLogout = async () => {
  await signOutUser();
  state.user = null;
  state.userMeta = null;
  state.players = {};
  state.activePlayer = null;
  state.rooms = {};
  state.publicProfiles = {};
  state.chatMessages = {};
  if (unwatchRooms) unwatchRooms();
  if (unwatchProfiles) unwatchProfiles();
  if (unwatchChat) unwatchChat();
  if (unwatchActiveRoom) unwatchActiveRoom();
  if (presenceTimer) clearInterval(presenceTimer);
  setScreen('first');
};





const applyFriendlyWagerResult = async (player, result) => {
  if (result.mode !== 'friendly' || !state.activeRoomId) return player;

  const room = await fetchRoom(state.activeRoomId).catch(() => state.activeRoom);
  if (!room) return player;

  const myPlayerId = player.id;
  const opponentPlayerId = room.hostPlayerId === myPlayerId ? room.guestPlayerId : room.hostPlayerId;
  const wager = Math.max(0, Number(room.wager || 0));
  const winnerPlayerId = result.win ? myPlayerId : opponentPlayerId;
  const loserPlayerId = result.win ? opponentPlayerId : myPlayerId;

  if (room.settledPlayers?.[myPlayerId]) return player;

  if (result.win) {
    player.gold = (player.gold || 0) + wager;
  } else {
    player.gold = Math.max(0, (player.gold || 0) - wager);
  }

  await updateRoomRemote(state.activeRoomId, {
    status: '종료',
    winnerPlayerId,
    loserPlayerId,
    [`settledPlayers/${myPlayerId}`]: true,
    endedAt: new Date().toISOString(),
  }).catch(() => {});

  const roomIdToRemove = state.activeRoomId;
  setTimeout(() => {
    if (roomIdToRemove) removeRoomRemote(roomIdToRemove).catch(() => {});
  }, 4500);

  showToast(result.win ? `친선경기 승리! ${wager}G 획득` : `친선경기 패배... ${wager}G 차감`, result.win ? 'success' : 'error');
  return player;
};

const handleLiveBattleResult = async (result) => {
  if (!state.activePlayer || state._battleResultSaving) return;
  state._battleResultSaving = true;
  state.battleHasResult = true;
  try {
    const player = clone(state.activePlayer);
    normalizeLoadedPlayer(player);
    player.stats.totalMatches = (player.stats.totalMatches || 0) + 1;
    player.stats.kills = (player.stats.kills || 0) + (result.kills || 0);
    player.stats.damage = (player.stats.damage || 0) + (result.damage || 0);
    player.stats.survivalTime = Math.max(player.stats.survivalTime || 0, result.survivalTime || 0);

    await applyFriendlyWagerResult(player, result);

    if (result.mode === 'friendly') {
      // 친선전은 위에서 배팅 골드만 정산하고 랭크 포인트/기본 보상은 적용하지 않습니다.
    } else if (result.mode === 'raidCoop' || result.mode === 'raidSoloDiablo' || result.mode === 'raidSoloGodzilla') {
      if (result.win) {
        player.inventory.customMaterials = (player.inventory.customMaterials || 0) + (result.mode === 'raidCoop' ? 7 : 5);
        player.gold = (player.gold || 0) + 35;
      }
    } else if (result.win) {
      player.stats.rankedWins = (player.stats.rankedWins || 0) + 1;
      if (result.mode === 'dungeon') {
        player.gold = (player.gold || 0) + 50;
        player.stats.dungeonClears = (player.stats.dungeonClears || 0) + 1;
      } else if (result.mode === 'auto') {
        player.gold = (player.gold || 0) + getRankedWinGoldForMode(player, 'auto');
        player.stats.rankedPointsAuto = Math.max(0, (player.stats.rankedPointsAuto || 0) + 12);
      } else if (result.mode === 'control') {
        player.gold = (player.gold || 0) + getRankedWinGoldForMode(player, 'control');
        player.stats.rankedPointsControl = Math.max(0, (player.stats.rankedPointsControl || 0) + 12);
      }
    } else {
      player.stats.rankedLosses = (player.stats.rankedLosses || 0) + 1;
      if (result.mode === 'auto') player.stats.rankedPointsAuto = Math.max(0, (player.stats.rankedPointsAuto || 0) - 6);
      else if (result.mode === 'control') player.stats.rankedPointsControl = Math.max(0, (player.stats.rankedPointsControl || 0) - 6);
    }

    const saved = await updatePlayerRemote(state.user.uid, player);
    await updatePublicPresence(state.user.uid, saved).catch(() => {});
    state.players[saved.id] = saved;
    state.activePlayer = saved;
    if (state.activeRoomId && result.mode !== 'friendly') {
      await updateRoomRemote(state.activeRoomId, {
        status: '종료',
        winnerUid: result.win ? state.user.uid : null,
        endedAt: new Date().toISOString(),
      }).catch(() => {});
    }
  } catch (error) {
    console.error(error);
    showToast('결과 저장 중 오류가 발생했습니다.', 'error');
  } finally {
    state._battleResultSaving = false;
  }
};

const handleStartLiveBattle = (mode) => {
  state.battleResultShown = false;
  state.liveBattleMode = mode || 'control';
  state.returnLobbyTab = mode === 'auto' ? 'autoHub' : mode === 'dungeon' ? 'autoHub' : mode === 'raidSoloDiablo' || mode === 'raidSoloGodzilla' ? 'controlHub' : mode === 'friendly' ? (state.lobbyTab || 'main') : 'controlHub';
  setScreen('liveBattle');
};



const handleOpenBattlePreview = (mode) => {
  state.previewMode = mode;
  setScreen('battlePreview');
};

const actionHandlers = {
  'go-login': () => setScreen('login'),
  'go-signup': () => setScreen('signup'),
  'goto-first': () => setScreen('first'),
  'submit-auth': ({ dataset }) => handleAuthSubmit(dataset.mode),
  'logout': () => handleLogout(),
  'create-player': () => handleCreatePlayer(),
  'select-player': ({ dataset }) => handleSelectPlayer(dataset.playerId),
  'back-player-select': () => setScreen('playerSelect'),
  'go-lobby': () => setScreen('lobby'),
  'start-adventure': () => setScreen('adventureMode'),
  'exit-adventure': () => { if (adventureCleanup) { adventureCleanup(); adventureCleanup = null; } setScreen('lobby'); },
  'download-resources': () => handleDownloadResources(),
  'set-lobby-tab': ({ dataset }) => {
    state.lobbyTab = dataset.tab;
    state.activePlayer.meta = state.activePlayer.meta || {};
    state.activePlayer.meta.lastViewedTab = dataset.tab;
    persistActivePlayer();
    scheduleRender();
  },
  'open-screen': ({ dataset }) => {
    state.lobbyTab = dataset.screen;
    state.activePlayer.meta = state.activePlayer.meta || {};
    state.activePlayer.meta.lastViewedTab = dataset.screen;
    persistActivePlayer();
    scheduleRender();
  },
  'open-delete-player': ({ dataset }) => setState({ modal: { type: 'deletePlayer', playerId: dataset.playerId } }),
  'confirm-delete-player': ({ dataset }) => handleDeletePlayer(dataset.playerId),
  'close-modal': () => closeModal(),
  'open-settings': () => setState({ modal: { type: 'settings', player: state.activePlayer } }),
  'save-settings': () => handleSaveSettings(),
  'open-dev-auth': () => setState({ modal: { type: 'devAuth' } }),
  'confirm-dev-mode': () => openDevMode(),
  'disable-dev-mode': () => disableDevMode(),
  'dev-adjust': ({ dataset }) => handleDevAdjust(dataset.field, dataset.value),
  'dev-unlock-all': () => handleDevUnlockAll(),
  'dev-pack': () => handleBuyPack(),
  'dev-reset-points': () => handleDevResetPoints(),
  'buy-pack': () => handleBuyPack(),
  'buy-item-pack': ({ dataset }) => handleBuyItemPack(dataset.packType),
  'equip-item': ({ dataset }) => handleEquipItem(dataset.characterId, dataset.itemId),
  'unequip-item': ({ dataset }) => handleUnequipItem(dataset.characterId, dataset.itemId),
  'open-item-pack-contents': ({ dataset }) => handleOpenItemPackContents(dataset.packType),
  'buy-character': ({ dataset }) => handleBuyCharacter(dataset.characterId),
  'set-active-character': ({ dataset }) => handleSetActiveCharacter(dataset.characterId),
  'toggle-auto-squad': ({ dataset }) => handleToggleAutoSquad(dataset.characterId),
  'enhance-character': ({ dataset }) => handleEnhanceCharacter(dataset.characterId),
  'simulate-ranked': ({ dataset }) => handleSimulateRanked(dataset.mode),
  'simulate-challenge': () => handleSimulateChallenge(),
  'simulate-dungeon': () => handleSimulateDungeon(),
  'claim-mission': ({ dataset }) => handleClaimMission(dataset.missionId),
  'enter-room-lobby': ({ dataset }) => handleEnterRoomLobby(dataset.roomId),
  'select-room-character': ({ dataset }) => handleSelectRoomCharacter(dataset.roomId, dataset.characterId),
  'guest-ready-room': ({ dataset }) => handleGuestReadyRoom(dataset.roomId),
  'host-start-room-battle': ({ dataset }) => handleHostStartRoomBattle(dataset.roomId, dataset.mode),
  'create-room': ({ dataset }) => setState({ modal: { type: 'createRoom', mode: dataset.mode } }),
  'confirm-create-room': ({ dataset }) => handleCreateRoom(dataset.mode),
  'join-room': ({ dataset }) => handleJoinRoom(dataset.roomId),
  'delete-room': ({ dataset }) => handleDeleteRoom(dataset.roomId),
  'leave-room': ({ dataset }) => handleLeaveRoom(dataset.roomId),
  'start-room-battle': ({ dataset }) => handleStartRoomBattle(dataset.roomId, dataset.mode),
  'send-chat': () => handleSendChat(),
  'open-player-info': ({ dataset }) => handleOpenPlayerInfo(dataset.profileKey),
  'open-character-info': ({ dataset }) => handleOpenCharacterInfo(dataset.characterId),
  'toggle-compare': ({ dataset }) => handleToggleCompare(dataset.characterId),
  'open-compare': () => handleOpenCompare(),
  'clear-compare': () => { state.compareSelection = []; scheduleRender(); },
  'craft-dummy': () => showToast('기본 제작 메뉴입니다. 아래 커스텀 제작을 이용하세요.', 'info'),
  'craft-custom-item': ({ dataset }) => handleCraftCustomItem(dataset.recipeId),
  'craft-free-custom-item': () => handleCraftFreeCustomItem(),
  'custom-item-help': () => showToast('보스 레이드에서 커스텀 재료를 얻고, 효과 2가지를 조합해 아이템을 만듭니다.', 'info'),
  'start-live-battle': ({ dataset }) => handleStartLiveBattle(dataset.mode),
  'open-battle-preview': ({ dataset }) => handleOpenBattlePreview(dataset.mode),
  'close-battle-preview': () => setScreen('lobby'),
  'exit-live-battle': () => handleExitLiveBattle(),
};

window.addEventListener('click', async (event) => {
  const actionTarget = event.target.closest('[data-action]');
  if (actionTarget) {
    const action = actionTarget.dataset.action;
    const handler = actionHandlers[action];
    if (!handler) return;
    event.preventDefault();
    try {
      await handler(actionTarget);
    } catch (error) {
      console.error(error);
      showToast(error.message || '작업 처리 중 오류가 발생했습니다.', 'error');
    }
    return;
  }
  if (event.target?.dataset?.closeModal !== undefined) {
    closeModal();
  }
}, true);

const boot = async () => {
  setScreen('loading');
  const init = initFirebase();
  if (!init.firebaseReady || !isFirebaseReady()) {
    appRoot.innerHTML = `<div class="center-shell"><div class="auth-card card"><h2>Firebase 초기화 실패</h2><p class="page-desc">config 또는 Realtime Database 설정을 확인해주세요.</p></div></div>`;
    return;
  }
  watchAuth(async (user) => {
    try {
      if (user) await bootstrapUser(user);
      else setScreen('first');
    } catch (error) {
      console.error(error);
      showToast(error.message || '계정 정보를 불러오는 중 오류가 발생했습니다.', 'error');
      setScreen('first');
    }
  });
};

boot();
