let lobbyAudio;
let battleAudio;
let currentVolume = 0.3;

const ensure = () => {
  if (!lobbyAudio) {
    lobbyAudio = new Audio('assets/sounds/2ways.mp3');
    lobbyAudio.loop = true;
  }
  if (!battleAudio) {
    battleAudio = new Audio('assets/sounds/narutobattle.mp3');
    battleAudio.loop = true;
  }
  lobbyAudio.volume = currentVolume;
  battleAudio.volume = currentVolume;
};

export const setGameVolume = (volume) => {
  currentVolume = Math.max(0, Math.min(1, Number(volume)));
  ensure();
  lobbyAudio.volume = currentVolume;
  battleAudio.volume = currentVolume;
};

export const playLobbyMusic = () => {
  ensure();
  battleAudio.pause();
  battleAudio.currentTime = 0;
  lobbyAudio.play().catch(() => {});
};

export const playBattleMusic = () => {
  ensure();
  lobbyAudio.pause();
  battleAudio.play().catch(() => {});
};

export const stopAllMusic = () => {
  ensure();
  lobbyAudio.pause();
  battleAudio.pause();
};
