export const APP_CONFIG = {
  gameName: '캐릭터 난투',
  defaultGold: 0,
  defaultTitle: '신입',
  nicknameMin: 2,
  nicknameMax: 15,
  devPin: '2359',
  packPrice: 300,
  basicItemPackPrice: 50,
  epicItemPackPrice: 5000,
  rankedRewardGold: 50,
  challengeCost: 5,
  challengeReward: 6,
  dungeonReward: 50,
  maxPlayersPerAccount: 2,
  controlTimeLimitSeconds: 180,
  maxEnhancement: 10,
  workerUrl: 'https://character-pvp-battle-worker.cks257510.workers.dev',
  defaultVolume: 0.3,
  presenceOnlineMs: 120000,
};

const baseConfig = {
  apiKey: 'AIzaSyAFHR-EgQ2zIIFTFQCHV3QzL3f2wh0U6Lc',
  authDomain: 'character1.firebaseapp.com',
  databaseURL: 'https://character1-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'character1',
  storageBucket: 'character1.firebasestorage.app',
  messagingSenderId: '318457976976',
  appId: '1:318457976976:web:9e45fe2844fafff36ce015',
};

export const firebaseConfig = {
  ...baseConfig,
  databaseURL: baseConfig.databaseURL,
};

export const PUBLIC_PATHS = {
  users: 'users',
  publicProfiles: 'publicProfiles',
  rooms: 'friendlyRooms',
  adventure: 'adventureWorld',
};
