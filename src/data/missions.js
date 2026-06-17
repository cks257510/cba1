export const MISSIONS = [
  { id: 'kill_5', name: '첫 사냥', description: '누적 5킬 달성', target: 5, type: 'kills', rewardGold: 20, rewardTitle: '사냥꾼' },
  { id: 'kill_20', name: '숙련 사냥꾼', description: '누적 20킬 달성', target: 20, type: 'kills', rewardGold: 50, rewardTitle: '베테랑 사냥꾼' },
  { id: 'damage_5000', name: '폭딜러', description: '누적 5000 데미지 달성', target: 5000, type: 'damage', rewardGold: 35, rewardTitle: '폭딜러' },
  { id: 'tank_120', name: '버티기의 달인', description: '최대 생존 시간 120초 달성', target: 120, type: 'survivalTime', rewardGold: 40, rewardTitle: '생존왕' },
  { id: 'ranked_win_3', name: '랭커의 시작', description: '경쟁전 3승 달성', target: 3, type: 'rankedWins', rewardGold: 40, rewardTitle: '루키 랭커' },
  { id: 'dungeon_clear_5', name: '던전 개척자', description: '오토모드 던전 5회 클리어', target: 5, type: 'dungeonClears', rewardGold: 50, rewardTitle: '던전 개척자' }
];
