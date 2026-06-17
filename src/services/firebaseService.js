import { firebaseConfig, PUBLIC_PATHS } from '../config.js';
import { buildDefaultPlayer, makePublicProfile } from './gameService.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  remove,
  onValue,
  off,
  push,
} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js';

let app;
let auth;
let db;
let firebaseReady = false;

export const initFirebase = () => {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getDatabase(app);
    firebaseReady = true;
    return { app, auth, db, firebaseReady: true };
  } catch (error) {
    console.error('Firebase init error:', error);
    firebaseReady = false;
    return { firebaseReady: false, error };
  }
};

export const isFirebaseReady = () => firebaseReady;
export const getFirebaseAuth = () => auth;
export const getFirebaseDb = () => db;

export const watchAuth = (callback) => onAuthStateChanged(auth, callback);

export const signUpWithEmail = async (email, password) => createUserWithEmailAndPassword(auth, email, password);
export const signInWithEmail = async (email, password) => signInWithEmailAndPassword(auth, email, password);
export const signOutUser = async () => signOut(auth);

export const ensureUserRoot = async (uid, email) => {
  const userRef = ref(db, `${PUBLIC_PATHS.users}/${uid}`);
  const snap = await get(userRef);
  if (!snap.exists()) {
    await set(userRef, {
      email,
      activePlayerId: null,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      players: {},
    });
  } else {
    await update(userRef, { lastLoginAt: new Date().toISOString() });
  }
};

export const fetchPlayers = async (uid) => {
  const snap = await get(ref(db, `${PUBLIC_PATHS.users}/${uid}/players`));
  return snap.exists() ? snap.val() : {};
};

export const fetchUserMeta = async (uid) => {
  const snap = await get(ref(db, `${PUBLIC_PATHS.users}/${uid}`));
  return snap.exists() ? snap.val() : null;
};


const isNicknameTaken = async (nickname, excludeKey = '') => {
  const target = String(nickname || '').trim().toLowerCase();
  if (!target) return false;
  const snap = await get(ref(db, PUBLIC_PATHS.publicProfiles));
  const profiles = snap.exists() ? snap.val() : {};
  return Object.entries(profiles || {}).some(([key, profile]) => {
    if (excludeKey && key === excludeKey) return false;
    return String(profile?.nickname || '').trim().toLowerCase() === target;
  });
};

export const createPlayer = async (uid, nickname) => {
  const players = await fetchPlayers(uid);
  const currentCount = Object.keys(players || {}).length;
  const safeNickname = String(nickname || '').trim();
  if (await isNicknameTaken(safeNickname)) throw new Error('이미 사용 중인 닉네임입니다.');
  const player = buildDefaultPlayer(safeNickname);
  if (currentCount >= 2) throw new Error('플레이어는 최대 2개까지 생성할 수 있습니다.');
  await set(ref(db, `${PUBLIC_PATHS.users}/${uid}/players/${player.id}`), player);
  await update(ref(db, `${PUBLIC_PATHS.users}/${uid}`), { activePlayerId: player.id, lastLoginAt: new Date().toISOString() });
  await set(ref(db, `${PUBLIC_PATHS.publicProfiles}/${uid}_${player.id}`), makePublicProfile(player));
  return player;
};

export const updatePlayer = async (uid, player) => {
  const payload = { ...player, updatedAt: new Date().toISOString() };
  await set(ref(db, `${PUBLIC_PATHS.users}/${uid}/players/${player.id}`), payload);
  await set(ref(db, `${PUBLIC_PATHS.publicProfiles}/${uid}_${player.id}`), makePublicProfile(payload));
  return payload;
};

export const setActivePlayerId = async (uid, playerId) => update(ref(db, `${PUBLIC_PATHS.users}/${uid}`), { activePlayerId: playerId, lastLoginAt: new Date().toISOString() });

export const deletePlayer = async ({ uid, playerId, email, password }) => {
  const credential = EmailAuthProvider.credential(email, password);
  await reauthenticateWithCredential(auth.currentUser, credential);
  await remove(ref(db, `${PUBLIC_PATHS.users}/${uid}/players/${playerId}`));
  await remove(ref(db, `${PUBLIC_PATHS.publicProfiles}/${uid}_${playerId}`));
  const players = await fetchPlayers(uid);
  const playerIds = Object.keys(players || {});
  await update(ref(db, `${PUBLIC_PATHS.users}/${uid}`), {
    activePlayerId: playerIds[0] || null,
    lastLoginAt: new Date().toISOString(),
  });
  return true;
};

export const watchRooms = (callback) => {
  const roomsRef = ref(db, PUBLIC_PATHS.rooms);
  const handler = onValue(roomsRef, (snap) => callback(snap.exists() ? snap.val() : {}));
  return () => off(roomsRef, 'value', handler);
};


export const fetchRoom = async (roomId) => {
  const snap = await get(ref(db, `${PUBLIC_PATHS.rooms}/${roomId}`));
  return snap.exists() ? snap.val() : null;
};

export const watchRoom = (roomId, callback) => {
  const roomRef = ref(db, `${PUBLIC_PATHS.rooms}/${roomId}`);
  const handler = onValue(roomRef, (snap) => callback(snap.exists() ? snap.val() : null));
  return () => off(roomRef, 'value', handler);
};

export const createRoom = async (room) => set(ref(db, `${PUBLIC_PATHS.rooms}/${room.id}`), room);
export const updateRoom = async (roomId, payload) => update(ref(db, `${PUBLIC_PATHS.rooms}/${roomId}`), payload);
export const removeRoom = async (roomId) => remove(ref(db, `${PUBLIC_PATHS.rooms}/${roomId}`));

export const watchPublicProfiles = (callback) => {
  const profilesRef = ref(db, PUBLIC_PATHS.publicProfiles);
  const handler = onValue(profilesRef, (snap) => callback(snap.exists() ? snap.val() : {}));
  return () => off(profilesRef, 'value', handler);
};


export const updatePublicPresence = async (uid, player) => {
  if (!player?.id) return;
  await set(ref(db, `${PUBLIC_PATHS.publicProfiles}/${uid}_${player.id}`), makePublicProfile(player));
};

export const watchGlobalChat = (callback) => {
  const chatRef = ref(db, 'globalChat');
  const handler = onValue(chatRef, (snap) => callback(snap.exists() ? snap.val() : {}));
  return () => off(chatRef, 'value', handler);
};

export const sendGlobalChat = async ({ uid, playerId, nickname, message }) => {
  const clean = String(message || '').trim().slice(0, 160);
  if (!clean) return;
  const chatRef = push(ref(db, 'globalChat'));
  await set(chatRef, {
    uid,
    playerId,
    nickname,
    message: clean,
    createdAt: new Date().toISOString(),
  });
};

export const bootstrapAfterLogin = async (user) => {
  await ensureUserRoot(user.uid, user.email || '');
  const meta = await fetchUserMeta(user.uid);
  const players = await fetchPlayers(user.uid);
  return { meta, players };
};

export const getFriendlyAuthErrorMessage = (error) => {
  const code = error?.code || '';
  if (code.includes('auth/email-already-in-use')) return '이미 사용 중인 이메일입니다.';
  if (code.includes('auth/invalid-email')) return '이메일 형식이 올바르지 않습니다.';
  if (code.includes('auth/weak-password')) return '비밀번호는 더 강하게 설정해주세요.';
  if (code.includes('auth/wrong-password') || code.includes('auth/invalid-credential')) return '비밀번호가 틀립니다';
  if (code.includes('auth/user-not-found')) return '존재하지 않는 이메일입니다';
  if (code.includes('auth/too-many-requests')) return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
  return error?.message || '요청 처리 중 오류가 발생했습니다.';
};
