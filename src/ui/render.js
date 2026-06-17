import { APP_CONFIG } from '../config.js';
import { CHARACTER_LIST, CHARACTER_MAP, BATTLE_NUMBERS, getTierFromPoints } from '../data/characters.js';
import { MISSIONS } from '../data/missions.js';
import { ITEM_LIST, ITEM_MAP, ITEM_PACKS, getItemStatText } from '../data/items.js';
import { enrichPlayer, buildLeaderboardRows, getMissionProgress, getEnhancementCost, getEnhancementRate, getComparableStats, getStatLabel, getOwnedItemObjects, getEquippedItemObjects, getTeamPower } from '../services/gameService.js';

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const avatarMarkup = (character, initials = '??', size = '') => {
  const text = initials.slice(0, 2).toUpperCase();
  return `
    <div class="avatar-token ${size}">
      ${character?.image ? `<img src="${character.image}" alt="${escapeHtml(character?.name || text)}" onerror="this.remove()" />` : ''}
      <span class="avatar-fallback">${escapeHtml(text)}</span>
    </div>
  `;
};


const itemIconMarkup = (item, size = '') => `
  <div class="skill-icon ${size} item-no-fallback" style="border-radius:16px;">
    ${item?.image ? `<img src="${item.image}" alt="${escapeHtml(item?.name || '')}" onerror="this.remove()" />` : ''}
  </div>
`;


const menuFeatureCard = ({ title, desc, icon, badgeText, badgeClass = '', action, screen = '' }) => `
  <button class="feature-card btn secondary menu-feature-card" data-action="${action}" ${screen ? `data-screen="${screen}"` : ''}>
    <div class="menu-feature-content">
      <div>
        <h3 class="feature-title">${escapeHtml(title)}</h3>
        <p class="feature-meta">${escapeHtml(desc)}</p>
      </div>
      <div class="tag-row">${badge(badgeText, badgeClass)}</div>
    </div>
    <div class="menu-feature-icon-wrap">
      <img class="menu-feature-icon" src="${icon}" alt="${escapeHtml(title)}" onerror="this.style.display='none'" />
    </div>
  </button>
`;



const getTierClass = (text = '') => {
  const raw = String(text);
  if (raw.includes('브론즈')) return 'tier-bronze';
  if (raw.includes('실버')) return 'tier-silver';
  if (raw.includes('골드')) return 'tier-gold';
  if (raw.includes('플레티넘')) return 'tier-platinum';
  if (raw.includes('다이아')) return 'tier-diamond';
  return '';
};

const getTitleClass = (text = '') => {
  const raw = String(text);
  if (raw.includes('신입')) return 'title-newbie';
  if (raw.includes('사냥꾼') && !raw.includes('베테랑')) return 'title-hunter';
  if (raw.includes('베테랑')) return 'title-veteran';
  if (raw.includes('폭딜러')) return 'title-damage';
  if (raw.includes('생존왕')) return 'title-tank';
  if (raw.includes('루키')) return 'title-rookie';
  if (raw.includes('던전')) return 'title-dungeon';
  if (raw.includes('챔피언')) return 'title-champion';
  if (raw.includes('MVP') || raw.includes('MoW') || raw.includes('MoM')) return 'title-rainbow';
  return 'title-default';
};

const badge = (text, extraClass = '') => {
  const autoClass = `${getTierClass(text)} ${getTitleClass(text)}`.trim();
  return `<span class="pill ${extraClass} ${autoClass}">${escapeHtml(text)}</span>`;
};

const tierBadge = (tier, points = null) => badge(points === null ? tier : `${tier} ${points}P`);
const titleBadge = (title) => badge(title || '신입', 'title-rainbow');
const rankedWinGoldForPoints = (points = 0) => Number(points || 0) >= 100 ? 80 : 50;


const statCard = (label, value) => `
  <div class="stat-card">
    <div class="stat-label">${escapeHtml(label)}</div>
    <div class="stat-value">${escapeHtml(value)}</div>
  </div>
`;

const authIntro = `
  <div class="brand-wrap">
    <h1 class="brand-title">${APP_CONFIG.gameName}</h1>
  </div>
`;

const renderFirstScreen = () => `
  <div class="center-shell">
    <div class="auth-card card">
      ${authIntro}
      <div class="stack">
        <button class="btn primary block" data-action="go-login">로그인</button>
        <button class="btn secondary block" data-action="go-signup">회원가입</button>
        
      </div>
    </div>
  </div>
`;

const renderAuthForm = (mode = 'login', state) => {
  const isLogin = mode === 'login';
  const error = state.authError ? `<div class="pill" style="background: rgba(245,79,102,.14); color:#ffd5de; border-color: rgba(245,79,102,.24)">${escapeHtml(state.authError)}</div>` : '';
  return `
  <div class="center-shell">
    <div class="auth-card card">
      ${authIntro}
      ${error}
      <div class="stack" style="margin-top:12px;">
        <div class="input-group">
          <label class="label">이메일</label>
          <input id="auth-email" class="text-input" type="email" placeholder="example@email.com" value="${escapeHtml(state.form.email || '')}" />
        </div>
        <div class="input-group">
          <label class="label">비밀번호</label>
          <input id="auth-password" class="text-input" type="password" placeholder="비밀번호 입력" value="${escapeHtml(state.form.password || '')}" />
        </div>
        <button class="btn primary block" data-action="submit-auth" data-mode="${mode}">${isLogin ? '로그인' : '회원가입'}</button>
        <button class="btn secondary block" data-action="goto-first">뒤로가기</button>
        <p class="inline-note">${isLogin ? '계정이 없다면 회원가입 후 로그인하세요.' : '회원가입 후 바로 로그인 상태로 전환됩니다.'}</p>
      </div>
    </div>
  </div>`;
};

const renderPlayerCard = (player) => {
  const enriched = enrichPlayer(player);
  return `
  <div class="player-card card">
    <div class="title-row">
      <div class="tag-row">
        ${badge(enriched.title, 'green')}
        ${badge(`골드 ${enriched.gold}`, 'gold')}
      </div>
      <button class="btn danger small" data-action="open-delete-player" data-player-id="${enriched.id}">삭제</button>
    </div>
    <div class="profile-head">
      ${avatarMarkup(enriched.activeCharacter, enriched.logoText, 'lg')}
      <div>
        <h3 class="profile-name">${escapeHtml(enriched.nickname)}</h3>
        <div class="tag-row">${tierBadge(enriched.tierControl, enriched.stats?.rankedPointsControl || 0)} ${tierBadge(enriched.tierAuto, enriched.stats?.rankedPointsAuto || 0)}</div>
      </div>
    </div>
    <div class="tag-row">
      ${badge(`보유 캐릭터 ${Object.keys(enriched.ownedCharacters || {}).length}명`)}
      ${badge(`활성 캐릭터 ${enriched.activeCharacter?.name || '-'}`)}
    </div>
    <div class="stat-grid" style="grid-template-columns:repeat(2,minmax(0,1fr));">
      ${statCard('킬', enriched.stats?.kills || 0)}
      ${statCard('데미지', enriched.stats?.damage || 0)}
    </div>
    <div class="row">
      <button class="btn primary" data-action="select-player" data-player-id="${enriched.id}">선택</button>
    </div>
  </div>`;
};

const renderPlayerSelect = (state) => {
  const players = Object.values(state.players || {});
  return `
  <div class="page-shell">
    <div class="title-row" style="margin: 16px 0 20px;">
      <div>
        <h1 class="page-title">플레이어 선택</h1>
        <p class="page-desc">최대 2개까지 생성할 수 있습니다</p>
      </div>
      <button class="player-select-mini" data-action="back-player-select">플레이어 선택</button>
          <button class="btn secondary" data-action="logout">로그아웃</button>
    </div>
    <div class="grid-2">
      ${players.map(renderPlayerCard).join('')}
      ${players.length < APP_CONFIG.maxPlayersPerAccount ? `
      <div class="player-card empty card">
        <div>
          <h3 class="page-title" style="font-size: 24px;">새 플레이어 생성</h3>
          <p class="page-desc">닉네임만 입력하면 바로 생성됩니다.</p>
        </div>
        <div class="stack" style="width:100%; max-width:300px;">
          <input id="new-player-name" class="text-input" maxlength="${APP_CONFIG.nicknameMax}" placeholder="닉네임 입력 (${APP_CONFIG.nicknameMin}~${APP_CONFIG.nicknameMax}글자)" />
          <button class="btn primary block" data-action="create-player">플레이어 생성</button>
        </div>
      </div>` : ''}
    </div>
  </div>`;
};

const renderPrepScreen = (state) => `
  <div class="page-shell">
    <div class="hero-grid">
      <div class="card content-panel">
        <div class="title-row">
          <div>
            <h1 class="page-title">준비 화면</h1>
            <p class="page-desc">리소스를 미리 캐시하고 로비로 이동할 수 있습니다.</p>
          </div>
          <button class="btn secondary" data-action="back-player-select">플레이어 선택</button>
        </div>
        <div class="stack" style="margin-top:20px; max-width:420px;">
          <button class="btn primary block" data-action="go-lobby">게임 시작</button>
          <button class="btn secondary block" data-action="download-resources">리소스다운로드(wifi환경)</button>
          ${state.resourceStatus ? `<div class="resource-status">${state.resourceLoading ? '<span class="spinner"></span>' : '✅'} <span>${escapeHtml(state.resourceStatus)}</span></div>` : ''}
        </div>
      </div>
      <div class="card content-panel">
        <h2 class="feature-title">선택된 플레이어</h2>
        <div style="margin-top:18px;">
          ${renderPlayerCard(state.activePlayer)}
        </div>
      </div>
    </div>
  </div>
`;

const renderSummaryCards = (player) => `
  <div class="stat-grid" style="margin-top:16px;">
    ${statCard('보유 캐릭터', Object.keys(player.ownedCharacters || {}).length)}
    ${statCard('컨트롤 포인트', player.stats?.rankedPointsControl || 0)}
    ${statCard('오토 포인트', player.stats?.rankedPointsAuto || 0)}
  </div>
`;

const mainTab = (player) => `
  <div class="stack">
    <div class="feature-card highlight">
      <div>
        <h2 class="feature-title">메인 대시보드</h2>
        <p class="feature-meta">기본 흐름은 메인 화면부터 시작합니다. 컨트롤모드, 오토모드, 플레이어, 랭킹, 미션으로 빠르게 이동할 수 있습니다.</p>
      </div>
      ${renderSummaryCards(player)}
    </div>
    <div class="grid-2 main-menu-grid">
      ${menuFeatureCard({
        title: '컨트롤모드',
        desc: '1대1 경쟁전, 친선방 개설/입장.',
        icon: 'assets/ui/controll.png',
        badgeText: `현재 티어 ${player.tierControl}`,
        badgeClass: 'green',
        action: 'open-screen',
        screen: 'controlHub',
      })}
      ${menuFeatureCard({
        title: '오토모드',
        desc: '2대2 오토배틀, 던전, 친선방.',
        icon: 'assets/ui/auto.png',
        badgeText: `현재 티어 ${player.tierAuto}`,
        badgeClass: 'green',
        action: 'open-screen',
        screen: 'autoHub',
      })}
      ${menuFeatureCard({
        title: '플레이어',
        desc: '온라인 플레이어, 정보, 채팅.',
        icon: 'assets/ui/user.png',
        badgeText: '온라인/채팅',
        badgeClass: '',
        action: 'open-screen',
        screen: 'players',
      })}
      ${menuFeatureCard({
        title: '랭킹',
        desc: '킬, 데미지, 탱커, 티어 순위.',
        icon: 'assets/ui/trophy.png',
        badgeText: 'TOP 10',
        badgeClass: '',
        action: 'open-screen',
        screen: 'rankings',
      })}
      ${menuFeatureCard({
        title: '미션',
        desc: '업적, 칭호, 보상 골드.',
        icon: 'assets/ui/mission.png',
        badgeText: '칭호 자동 갱신',
        badgeClass: '',
        action: 'open-screen',
        screen: 'missions',
      })}
      ${menuFeatureCard({
        title: '어드벤처',
        desc: '탑뷰 생존, 채집, 제작, 국가 전투.',
        icon: 'assets/ui/home.png',
        badgeText: '온라인 월드',
        badgeClass: 'gold',
        action: 'open-screen',
        screen: 'adventure',
      })}
    </div>
  </div>
`;


const craftTab = (player) => `
  <div class="stack">
    <div class="feature-card highlight">
      <div class="title-row">
        <div>
          <h2 class="feature-title">제작소</h2>
          <p class="feature-meta">보스 레이드에서 얻은 커스텀 재료로 원하는 기능 2가지를 자유롭게 조합해 1개의 아이템을 만듭니다.</p>
        </div>
        <div class="tag-row">${badge(`커스텀 재료 ${player.inventory?.customMaterials || 0}개`, 'gold')}</div>
      </div>
    </div>

    <div class="feature-card">
      <h3 class="feature-title">자유 조합 커스텀 제작</h3>
      <p class="feature-meta">효과 2가지를 선택하면 능력치와 기능이 합쳐진 커스텀 아이템이 생성됩니다.</p>
      <div class="grid-2" style="margin-top:14px;">
        <div class="input-group">
          <label class="label">효과 1</label>
          <select id="custom-effect-a" class="text-input">
            <option value="teleportPlus">텔레포트 강화</option>
            <option value="attackSpeedPlus">공격속도 증가</option>
            <option value="reverseControl">상대 조작 2초 반전</option>
            <option value="slowHit">상대 이동속도 1초 둔화</option>
            <option value="blinkHaste">점멸 강화</option>
            <option value="critFocus">치명타 집중</option>
          </select>
        </div>
        <div class="input-group">
          <label class="label">효과 2</label>
          <select id="custom-effect-b" class="text-input">
            <option value="attackSpeedPlus">공격속도 증가</option>
            <option value="teleportPlus">텔레포트 강화</option>
            <option value="reverseControl">상대 조작 2초 반전</option>
            <option value="slowHit">상대 이동속도 1초 둔화</option>
            <option value="blinkHaste">점멸 강화</option>
            <option value="critFocus">치명타 집중</option>
          </select>
        </div>
      </div>
      <input id="custom-item-name" class="text-input" style="margin-top:12px;" maxlength="16" placeholder="아이템 이름 입력 또는 비워두면 자동 생성" />
      <div class="row" style="margin-top:12px;">
        <button class="btn primary" data-action="craft-free-custom-item">커스텀 아이템 제작</button>
        <button class="btn secondary" data-action="custom-item-help">설명</button>
      </div>
      <div class="reward-info-box" style="margin-top:12px;">
        <strong>재료 획득처</strong>
        <span>보스 레이드 승리 시 획득: 1인도전 5개 · 협동 레이드 7개</span>
        <span>제작 비용: 선택한 효과 2개 조합 기준 5~7개</span>
      </div>
    </div>

    <div class="feature-card">
      <h3 class="feature-title">효과 설명</h3>
      <div class="stack" style="margin-top:12px;">
        <div class="custom-item-line"><b>텔레포트 강화</b><p class="feature-meta">점멸 거리가 증가합니다.</p></div>
        <div class="custom-item-line"><b>공격속도 증가</b><p class="feature-meta">기본 공격속도가 올라갑니다.</p></div>
        <div class="custom-item-line"><b>상대 조작 반전</b><p class="feature-meta">공격 시 낮은 확률로 상대 이동 조작이 2초 동안 반대로 됩니다.</p></div>
        <div class="custom-item-line"><b>상대 둔화</b><p class="feature-meta">공격 적중 시 상대 이동속도가 1초 동안 조금 느려집니다.</p></div>
        <div class="custom-item-line"><b>점멸 강화</b><p class="feature-meta">점멸 성능이 강화됩니다.</p></div>
        <div class="custom-item-line"><b>치명타 집중</b><p class="feature-meta">치명타 확률과 공격력이 상승합니다.</p></div>
      </div>
    </div>
  </div>`;


const shopTab = (player, state) => {
  const unowned = CHARACTER_LIST.filter((character) => !player.ownedCharacters?.[character.id]);
  return `
  <div class="stack">
    <div class="feature-card highlight">
      <div class="title-row">
        <div>
          <h2 class="feature-title">상점</h2>
          <p class="feature-meta">캐릭터팩 500골드 / 캐릭터 직접 구매 가능</p>
        </div>
        <div class="tag-row">${badge(`보유 골드 ${player.gold}`, 'gold')}</div>
      </div>
      <div class="row" style="margin-top:16px;">
        <button class="btn primary" data-action="buy-pack">캐릭터팩 구매 / 개봉 (${APP_CONFIG.packPrice}G)</button>
        <button class="btn secondary" data-action="open-compare">선택 캐릭터 비교</button>
        <button class="btn ghost" data-action="clear-compare">비교 선택 초기화</button>
      </div>
      <p class="inline-note" style="margin-top:10px;">비교 선택: ${(state.compareSelection || []).length} / 3</p>
    </div>
    <div class="feature-card">
      <div class="title-row">
        <div>
          <h3 class="feature-title">아이템 팩</h3>
          <p class="feature-meta">기본 아이템 팩 50G / 에픽 아이템 팩 5000G</p>
        </div>
        <div class="tag-row">${badge(`보유 골드 ${player.gold}`, 'gold')}</div>
      </div>
      <div class="grid-2" style="margin-top:16px;">
        <div class="character-card">
          <h4 class="character-name">기본 아이템 팩</h4>
          <p class="character-sub">기본 아이템 중 1개 랜덤 획득</p>
          <div class="tag-row">${badge('50G', 'gold')}${badge('기본')}</div>
          <div class="row">
            <button class="btn primary small" data-action="buy-item-pack" data-pack-type="basic">개봉</button>
            <button class="btn secondary small" data-action="open-item-pack-contents" data-pack-type="basic">내용 확인</button>
          </div>
        </div>
        <div class="character-card">
          <h4 class="character-name">에픽 아이템 팩</h4>
          <p class="character-sub">에픽 아이템 중 1개 랜덤 획득</p>
          <div class="tag-row">${badge('3000G', 'gold')}${badge('에픽', 'green')}</div>
          <div class="row">
            <button class="btn primary small" data-action="buy-item-pack" data-pack-type="epic">개봉</button>
            <button class="btn secondary small" data-action="open-item-pack-contents" data-pack-type="epic">내용 확인</button>
          </div>
        </div>
      </div>
    </div>

    <div class="feature-card">
      <h3 class="feature-title">직접 구매 캐릭터</h3>
      <p class="feature-meta">이미 보유한 캐릭터는 구매할 수 없습니다.</p>
      <div class="character-grid" style="margin-top:16px;">
        ${unowned.map((character) => `
          <div class="character-card">
            <div class="character-head">
              ${avatarMarkup(character, character.englishName.slice(0,2))}
              <div>
                <h4 class="character-name">${escapeHtml(character.name)}</h4>
                <p class="character-sub">${escapeHtml(character.role)} · ${escapeHtml(character.rarity)}</p>
              </div>
            </div>
            <div class="tag-row">
              ${badge(`${character.shopPrice}G`, 'gold')}
              ${badge(character.ultimate.name)}
              ${badge(`HP ${character.baseStats.hp}`)}
              ${badge(`ATK ${character.baseStats.attack}`)}
            </div>
            <div class="row">
              <button class="btn secondary small" data-action="open-character-info" data-character-id="${character.id}">정보확인</button>
              <button class="btn ghost small" data-action="toggle-compare" data-character-id="${character.id}">${(state.compareSelection || []).includes(character.id) ? '비교해제' : '비교선택'}</button>
              <button class="btn secondary small" data-action="buy-character" data-character-id="${character.id}">구매</button>
            </div>
          </div>
        `).join('') || `<div class="empty-state">모든 캐릭터를 이미 보유하고 있습니다.</div>`}
      </div>
    </div>
  </div>`;
};

const squadTab = (player, state) => {
  const owned = player.ownedCharacterObjects || [];
  return `
  <div class="stack">
    <div class="feature-card highlight">
      <div class="title-row">
        <div>
          <h2 class="feature-title">스쿼드</h2>
          <p class="feature-meta">컨트롤 캐릭터, 오토 스쿼드(2인), 강화, 캐릭터 정보를 관리합니다.</p>
        </div>
        <div class="tag-row">${badge(`활성 캐릭터 ${player.activeCharacter?.name || '-'}`, 'green')}</div>
      </div>
    </div>
    <div class="character-grid">
      ${owned.map((character) => {
        const enhancement = character.ownership?.enhancement || 0;
        return `
        <div class="character-card ${player.activeCharacterId === character.id ? 'selected' : ''}">
          <div class="character-head">
            ${avatarMarkup(character, character.englishName?.slice(0, 2) || character.id.slice(0, 2))}
            <div>
              <h4 class="character-name">${escapeHtml(character.name)}</h4>
              <p class="character-sub">${escapeHtml(character.role)} · 강화 +${enhancement}</p>
            </div>
          </div>
          <div class="tag-row">
            ${badge(`HP ${character.baseStats?.hp || 0}`)}
            ${badge(`ATK ${character.baseStats?.attack || 0}`)}
            ${badge(`AS ${character.baseStats?.attackSpeed || 0}`)}
            ${badge(`SPD ${character.baseStats?.speed || 0}`)}
            ${badge(`CRIT ${character.baseStats?.critChance || 0}%`)}
          </div>
          <div class="skill-list">
            <div class="skill-chip"><div class="skill-icon">${character.skill1?.image ? `<img src="${character.skill1.image}" alt="" onerror="this.remove()" />` : ''}</div><div><strong>${escapeHtml(character.skill1?.name || '-')}</strong><div class="inline-note">${escapeHtml(character.skill1?.description || '')}</div></div></div>
            <div class="skill-chip"><div class="skill-icon">${character.ultimate?.image ? `<img src="${character.ultimate.image}" alt="" onerror="this.remove()" />` : ''}</div><div><strong>${escapeHtml(character.ultimate?.name || '-')}</strong><div class="inline-note">${escapeHtml(character.ultimate?.description || '')}</div></div></div>
          </div>
          <div class="tag-row" style="margin-top:8px;">
            ${badge('장착 아이템')}
            ${(player.equippedItems?.[character.id] || []).map((itemId) => badge(ITEM_MAP[itemId]?.name || itemId, 'green')).join('') || badge('없음')}
          </div>
          <div class="row">
            <button class="btn primary small" data-action="set-active-character" data-character-id="${character.id}">컨트롤 대표</button>
            <button class="btn secondary small" data-action="toggle-auto-squad" data-character-id="${character.id}">${(player.autoSquad || []).includes(character.id) ? '오토 스쿼드 해제' : '오토 스쿼드 추가'}</button>
            <button class="btn ghost small" data-action="open-character-info" data-character-id="${character.id}">정보확인</button>
            <button class="btn ghost small" data-action="toggle-compare" data-character-id="${character.id}">${(state.compareSelection || []).includes(character.id) ? '비교해제' : '비교선택'}</button>
            <button class="btn secondary small" data-action="open-compare">비교 보기</button>
          </div>
          <div class="stack">
            <div class="inline-note">강화 비용 ${getEnhancementCost(enhancement)}G / 성공률 ${getEnhancementRate(enhancement)}%</div>
            <button class="btn warning small" data-action="enhance-character" data-character-id="${character.id}">강화 시도</button>
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
};




const itemsTab = (player) => {
  const ownedItems = getOwnedItemObjects(player || {});
  const activeCharacterId = player.activeCharacterId;
  const activeCharacter = CHARACTER_MAP[activeCharacterId];
  const equippedIds = player.equippedItems?.[activeCharacterId] || [];
  return `
  <div class="stack">
    <div class="feature-card highlight">
      <h2 class="feature-title">아이템</h2>
      <div class="stat-grid" style="margin-top:16px;">
        ${statCard('기본 팩 개봉', player.inventory?.basicItemPacks || 0)}
        ${statCard('에픽 팩 개봉', player.inventory?.epicItemPacks || 0)}
        ${statCard('보유 아이템 종류', ownedItems.length)}
        ${statCard('현재 캐릭터 장착', `${equippedIds.length}/2`)}
      </div>
      <div class="tag-row" style="margin-top:12px;">${badge(`장착 대상 ${activeCharacter?.name || '-'}`, 'green')}</div>
    </div>
    <div class="character-grid">
      ${ownedItems.length ? ownedItems.map((item) => {
        const equipped = equippedIds.includes(item.id);
        const full = equippedIds.length >= 2 && !equipped;
        return `
        <div class="character-card ${equipped ? 'selected' : ''}">
          <div class="character-head">
            ${itemIconMarkup(item)}
            <div>
              <h4 class="character-name">${escapeHtml(item.name)}</h4>
              <p class="character-sub">${escapeHtml(item.rarity)} · 보유 ${item.count}개</p>
            </div>
          </div>
          <div class="tag-row">${getItemStatText(item).split(' / ').map((part) => badge(part, item.rarity === '에픽' ? 'green' : '')).join('')}</div>
          <div class="row">
            ${equipped ? `<button class="btn secondary small" data-action="unequip-item" data-item-id="${item.id}" data-character-id="${activeCharacterId}">해제</button>` : `<button class="btn primary small" ${full ? 'disabled' : ''} data-action="equip-item" data-item-id="${item.id}" data-character-id="${activeCharacterId}">장착</button>`}
          </div>
        </div>`;
      }).join('') : `<div class="empty-state">보유한 아이템이 없습니다.</div>`}
    </div>
  </div>`;
};

const getTierProgress = (points = 0) => {
  const safe = Math.max(0, Number(points || 0));
  const current = safe % 50;
  const percent = Math.min(100, (current / 50) * 100);
  const nextPoint = 50 - current;
  return { current, percent, nextPoint: current === 0 && safe > 0 ? 50 : nextPoint };
};

const tierPanel = (label, tier, points) => {
  const progress = getTierProgress(points);
  return `
    <div class="tier-meter">
      <div class="tier-meter-head">
        <div>
          <strong>${escapeHtml(label)}</strong>
          <div class="inline-note">현재 티어 ${escapeHtml(tier)} · 포인트 ${points}</div>
        </div>
        ${badge(`${progress.current}/50`, 'green')}
      </div>
      <div class="tier-gauge"><span style="width:${progress.percent}%"></span></div>
      <div class="inline-note" style="margin-top:8px;">다음 승급까지 ${progress.current === 0 && points > 0 ? 50 : progress.nextPoint}포인트</div>
    </div>
  `;
};



const controlHub = (player) => `
  <div class="stack">
    <div class="feature-card highlight">
      <div class="title-row">
        <div>
          <h2 class="feature-title">컨트롤모드</h2>
          <p class="feature-meta">컨트롤 대전, 친선경기, 보스 레이드가 하나의 허브로 정리되었습니다.</p>
        </div>
        <div class="tag-row">${badge(`티어 ${player.tierControl}`, 'green')}${badge(`${player.stats?.rankedPointsControl || 0}P`)}</div>
      </div>
      ${tierPanel('컨트롤 랭크', player.tierControl, player.stats?.rankedPointsControl || 0)}
      <div class="stat-grid" style="margin-top:16px;">
        ${statCard('현재 티어', player.tierControl)}
        ${statCard('포인트', player.stats?.rankedPointsControl || 0)}
        ${statCard('승급 단위', '50P')}
        ${statCard('레이드 재료', player.inventory?.customMaterials || 0)}
      </div>
      <div class="row" style="margin-top:16px; flex-wrap:wrap;">
        <button class="btn primary" data-action="start-live-battle" data-mode="control">경쟁전 시작</button>
        <button class="btn secondary" data-action="open-screen" data-screen="controlRooms">친선방 보기</button>
      </div>
      <div class="reward-info-box" style="margin-top:14px;">
        <strong>경쟁전 보상</strong>
        <span>승리 보상: 현재 ${rankedWinGoldForPoints(player.stats?.rankedPointsControl || 0)}G · 브론즈/실버 50G · 골드 이상 80G</span>
        <span>포인트: 승리 +12P / 패배 -6P</span>
      </div>
    </div>

    <div class="feature-card">
      <div class="title-row">
        <div>
          <h3 class="feature-title">보스 레이드</h3>
          <p class="feature-meta">1인도전은 직접 조작 1명 + 자동 전투 1명, 협동은 2인 조작 레이드입니다.</p>
        </div>
        <button class="btn secondary" data-action="open-screen" data-screen="raidRooms">협동 레이드방</button>
      </div>
      <div class="raid-boss-grid" style="margin-top:14px;">
        <div class="raid-boss-card">
          <img src="assets/boss/diablo.png" alt="디아블로" />
          <h4 class="character-name">디아블로</h4>
          <p class="character-sub">화염 투사체, 지옥 레이저, 화염 폭발</p>
          <div class="row" style="margin-top:10px;">
            <button class="btn primary small" data-action="start-live-battle" data-mode="raidSoloDiablo">1인 도전</button>
            <button class="btn secondary small" data-action="create-room" data-mode="raidCoop">협동방 생성</button>
          </div>
        </div>
        <div class="raid-boss-card">
          <img src="assets/boss/godzilla.png" alt="고질라" />
          <h4 class="character-name">고질라</h4>
          <p class="character-sub">원자 브레스, 꼬리 충격파, 등지느러미 탄막</p>
          <div class="row" style="margin-top:10px;">
            <button class="btn primary small" data-action="start-live-battle" data-mode="raidSoloGodzilla">1인 도전</button>
            <button class="btn secondary small" data-action="open-screen" data-screen="raidRooms">협동방 보기</button>
          </div>
        </div>
      </div>
      <div class="reward-info-box" style="margin-top:14px;">
        <strong>레이드 보상</strong>
        <span>승리 시 커스텀 아이템 재료 획득</span>
        <span>1인도전 5개 · 협동 레이드 7개</span>
      </div>
    </div>
  </div>`;

const autoHub = (player) => `
  <div class="stack">
    <div class="feature-card highlight">
      <div class="title-row">
        <div>
          <h2 class="feature-title">오토모드</h2>
          <p class="feature-meta">2대2 자동 전투, 자동 스킬/궁극기, 유도 투사체, 던전과 도전 기능이 포함됩니다.</p>
        </div>
        <div class="tag-row">${badge(`티어 ${player.tierAuto}`, 'green')}${badge(`${player.stats?.rankedPointsAuto || 0}P`)}</div>
      </div>
      ${tierPanel('오토 랭크', player.tierAuto, player.stats?.rankedPointsAuto || 0)}
      <div class="stat-grid" style="margin-top:16px;">
        ${statCard('현재 티어', player.tierAuto)}
        ${statCard('포인트', player.stats?.rankedPointsAuto || 0)}
        ${statCard('승급 단위', '50P')}
        ${statCard('전투 인원', '2대2')}
      </div>
      <div class="row" style="margin-top:16px; flex-wrap:wrap;">
        <button class="btn primary" data-action="start-live-battle" data-mode="auto">경쟁전 시작</button>
        <button class="btn secondary" data-action="simulate-challenge">상대 프로필 도전 (5G)</button>
        <button class="btn secondary" data-action="start-live-battle" data-mode="dungeon">던전 도전</button>
        <button class="btn ghost" data-action="open-screen" data-screen="autoRooms">친선방 보기</button>
      </div>
      <div class="reward-info-box">
        <strong>오토 경쟁전 보상</strong>
        <span>승리 보상: 현재 ${rankedWinGoldForPoints(player.stats?.rankedPointsAuto || 0)}G · 브론즈/실버 50G · 골드 이상 80G</span>
        <span>포인트: 승리 +12P / 패배 -6P</span>
        <strong>던전 보상</strong>
        <span>클리어 보상: 50G · 제한시간 40초 · 목표 클리어 20~30초</span>
      </div>
      ${player.borrowCharacterAvailable && player.borrowedCharacterId ? `<div class="pill green" style="margin-top:14px;">대여 가능 캐릭터: ${escapeHtml(CHARACTER_MAP[player.borrowedCharacterId]?.name || '-')}</div>` : ''}
    </div>
  </div>
`;




const roomScreen = (state, mode = 'control') => {
  const rooms = Object.values(state.rooms || {}).filter((room) => room.mode === mode);
  const player = enrichPlayer(state.activePlayer || {});
  const activePlayerId = state.activePlayer?.id;
  const modeLabel = mode === 'control' ? '컨트롤모드' : mode === 'raidCoop' ? '협동 레이드' : '오토모드';
  return `
  <div class="stack">
    <div class="feature-card highlight">
      <div class="title-row">
        <h2 class="feature-title">${mode === 'raidCoop' ? '협동 레이드방' : `${modeLabel} 친선방`}</h2>
        <button class="btn primary" data-action="create-room" data-mode="${mode}">방 생성</button>
      </div>
      ${tierPanel(modeLabel, mode === 'control' ? player.tierControl : player.tierAuto, mode === 'control' ? player.stats?.rankedPointsControl || 0 : player.stats?.rankedPointsAuto || 0)}
    </div>
    <div class="feature-card">
      <h3 class="feature-title">방 목록</h3>
      <div class="stack" style="margin-top:16px;">
        ${rooms.length ? rooms.map((room) => {
          const isHost = room.hostPlayerId === activePlayerId;
          const isGuest = room.guestPlayerId === activePlayerId;
          const mine = isHost || isGuest;
          const canEnter = mine || !room.guestPlayerId;
          return `
          <div class="character-card ${mine ? 'selected' : ''}">
            <div class="title-row">
              <div>
                <h4 class="character-name">${escapeHtml(room.hostNickname)}의 방</h4>
                <p class="character-sub">${escapeHtml(room.status || '대기중')} · ${room.wager || 0}G</p>
              </div>
              <div class="tag-row">
                ${badge(mode === 'control' ? '1대1' : mode === 'raidCoop' ? '2인 협동' : '2대2')}
                ${isHost ? badge('내가 만든 방', 'gold') : isGuest ? badge('게스트로 입장중', 'green') : badge(room.guestNickname ? `게스트 ${room.guestNickname}` : '입장 가능')}
              </div>
            </div>
            <div class="row">
              ${canEnter ? `<button class="btn primary small" data-action="enter-room-lobby" data-room-id="${room.id}" data-mode="${mode}">${mode === 'raidCoop' ? '레이드방 입장' : '친선방 입장'}</button>` : ''}
              ${mine ? `<button class="btn secondary small" data-action="leave-room" data-room-id="${room.id}">나가기</button>` : ''}
              ${isHost ? `<button class="btn danger small" data-action="delete-room" data-room-id="${room.id}">삭제</button>` : ''}
            </div>
          </div>`;
        }).join('') : `<div class="empty-state">생성된 방이 없습니다.</div>`}
      </div>
    </div>
  </div>`;
};

const isProfileOnline = (profile) => {
  const t = Date.parse(profile?.lastActiveAt || profile?.updatedAt || 0);
  if (!t) return false;
  return Date.now() - t <= APP_CONFIG.presenceOnlineMs;
};

const playersScreen = (state) => {
  const profiles = Object.entries(state.publicProfiles || {}).map(([key, profile]) => ({ key, ...profile }));
  const chatMessages = Object.values(state.chatMessages || {})
    .sort((a, b) => Date.parse(a.createdAt || 0) - Date.parse(b.createdAt || 0))
    .slice(-30);
  return `
  <div class="stack">
    <div class="feature-card highlight">
      <div class="title-row">
        <div>
          <h2 class="feature-title">플레이어</h2>
          <p class="feature-meta">서버에 저장된 플레이어 목록, 온/오프라인 여부, 플레이어 정보, 전체 채팅입니다.</p>
        </div>
        <div class="tag-row">
          ${badge(`전체 ${profiles.length}명`)}
          ${badge(`온라인 ${profiles.filter(isProfileOnline).length}명`, 'green')}
        </div>
      </div>
    </div>
    <div class="grid-2">
      <div class="feature-card">
        <h3 class="feature-title">서버 플레이어 목록</h3>
        <div class="stack" style="margin-top:14px;">
          ${profiles.length ? profiles.map((profile) => {
            const active = CHARACTER_MAP[profile.activeCharacterId];
            const online = isProfileOnline(profile);
            return `
              <div class="character-card">
                <div class="title-row">
                  <div class="character-head">
                    ${avatarMarkup(active, profile.logoText || profile.nickname?.slice(0,2) || '??')}
                    <div>
                      <h4 class="character-name">${escapeHtml(profile.nickname || '-')}</h4>
                      <div class="tag-row" style="margin-top:4px;">${titleBadge(profile.title || '-')} ${tierBadge(getTierFromPoints(profile.stats?.rankedPointsControl || 0), profile.stats?.rankedPointsControl || 0)} ${tierBadge(getTierFromPoints(profile.stats?.rankedPointsAuto || 0), profile.stats?.rankedPointsAuto || 0)}</div><p class="character-sub">${online ? '온라인' : '오프라인'}</p>
                    </div>
                  </div>
                  ${badge(online ? 'ON' : 'OFF', online ? 'green' : '')}
                </div>
                <div class="tag-row">
                  ${badge(`팀가치 ${Number(profile.teamValue || 0).toLocaleString()}`, 'gold')}
                  ${badge(`보유 ${profile.ownedCharacterCount || 0}명`)}
                  ${badge(`킬 ${profile.stats?.kills || 0}`)}
                </div>
                <button class="btn secondary small" data-action="open-player-info" data-profile-key="${profile.key}">플레이어 정보</button>
              </div>
            `;
          }).join('') : `<div class="empty-state">아직 서버에 표시할 플레이어가 없습니다.</div>`}
        </div>
      </div>
      <div class="feature-card">
        <h3 class="feature-title">전체 채팅</h3>
        <div class="logs" style="margin-top:14px; max-height:360px;">
          ${chatMessages.length ? chatMessages.map((msg) => `
            <div class="log-item">
              <strong>${escapeHtml(msg.nickname || '익명')}</strong>
              <span class="inline-note">${escapeHtml((msg.createdAt || '').slice(11, 16))}</span>
              <div>${escapeHtml(msg.message || '')}</div>
            </div>
          `).join('') : `<div class="empty-state">아직 채팅이 없습니다.</div>`}
        </div>
        <div class="row" style="margin-top:14px;">
          <input id="global-chat-input" class="text-input" maxlength="160" placeholder="채팅 입력 (최대 160자)" style="flex:1; min-width:180px;" />
          <button class="btn primary" data-action="send-chat">전송</button>
        </div>
      </div>
    </div>
  </div>`;
};



const rankingsScreen = (state) => {
  const rows = buildLeaderboardRows(Object.values(state.publicProfiles || {}));
  const sections = [
    { key: 'tier', label: '티어 랭킹', valueLabel: '티어 포인트' },
    { key: 'kills', label: 'Kill 랭킹', valueLabel: '킬' },
    { key: 'damage', label: '데미지 랭킹', valueLabel: '데미지' },
    { key: 'tank', label: '탱커 랭킹', valueLabel: '최대 생존' },
  ];
  const valueFor = (row, key) => {
    if (key === 'tier') return `${row.tierScore}P`;
    return row[key] || 0;
  };
  return `
  <div class="stack">
    ${sections.map((section) => `
      <div class="feature-card">
        <div class="title-row">
          <h2 class="feature-title">${section.label}</h2>
        </div>
        <table class="table" style="margin-top:12px;">
          <thead><tr><th>#</th><th>플레이어</th><th>캐릭터</th><th>칭호</th><th>티어</th><th>${section.valueLabel}</th></tr></thead>
          <tbody>
            ${(rows[section.key] || []).slice(0, 10).map((row, index) => `
              <tr>
                <td><span class="rank-num">${index + 1}</span></td>
                <td>${escapeHtml(row.nickname || '-')}</td>
                <td>
                  <div class="character-head" style="gap:8px;">
                    ${avatarMarkup({ image: row.activeCharacterImage, name: row.activeCharacterName }, row.activeCharacterName?.slice(0,2) || '??')}
                    <span>${escapeHtml(row.activeCharacterName || '-')}</span>
                  </div>
                </td>
                <td>${titleBadge(row.title || '-')}</td>
                <td>
                  <div class="tag-row">
                    ${tierBadge(row.controlTier, row.controlPoints)}
                    ${tierBadge(row.autoTier, row.autoPoints)}
                  </div>
                </td>
                <td>${escapeHtml(valueFor(row, section.key))}</td>
              </tr>
            `).join('') || '<tr><td colspan="6">아직 누적 데이터가 없습니다.</td></tr>'}
          </tbody>
        </table>
      </div>
    `).join('')}
  </div>`;
};


const adventureScreen = (player) => `
  <div class="stack">
    <div class="feature-card highlight">
      <div class="title-row">
        <div>
          <h2 class="feature-title">어드벤처 모드</h2>
          <p class="feature-meta">탑뷰 생존/채집/제작/건축/국가 전투 모드입니다. 입장하면 온라인 월드에 바로 접속됩니다.</p>
        </div>
        <button class="btn primary" data-action="start-adventure">어드벤처 입장</button>
      </div>
      <div class="reward-info-box" style="margin-top:14px;">
        <strong>기본 규칙</strong>
        <span>나무, 돌, 철광석을 채집하고 5분 후 재생성됩니다.</span>
        <span>데마시아는 플레이어 국가, 녹서스는 AI 국가입니다.</span>
        <span>벽과 문을 설치하고 백성 집으로 주민/기사 수를 늘릴 수 있습니다.</span>
      </div>
    </div>
  </div>`;

const missionsScreen = (player) => `
  <div class="stack">
    <div class="feature-card highlight">
      <h2 class="feature-title">미션 / 업적 / 칭호</h2>
      <p class="feature-meta">보상 수령 시 골드를 지급하고, 칭호가 변경됩니다.</p>
    </div>
    <div class="character-grid">
      ${MISSIONS.map((mission) => {
        const progress = getMissionProgress(player, mission);
        const claimed = !!player.missionsClaimed?.[mission.id];
        const percent = Math.min(100, Math.floor((progress / mission.target) * 100));
        return `
          <div class="character-card ${claimed ? 'selected' : ''}">
            <div>
              <h3 class="character-name">${escapeHtml(mission.name)}</h3>
              <p class="character-sub">${escapeHtml(mission.description)}</p>
            </div>
            <div class="progress"><span style="width:${percent}%"></span></div>
            <div class="title-row">
              <div class="inline-note">${progress} / ${mission.target}</div>
              <div class="tag-row">${badge(`${mission.rewardGold}G`, 'gold')}${badge(mission.rewardTitle)}</div>
            </div>
            <button class="btn ${claimed ? 'secondary' : 'primary'}" ${claimed ? 'disabled' : ''} data-action="claim-mission" data-mission-id="${mission.id}">${claimed ? '수령 완료' : '보상 수령'}</button>
          </div>
        `;
      }).join('')}
    </div>
  </div>`;

const renderDevPanel = (player) => `
  <div class="feature-card dev-mode-card">
    <div class="title-row">
      <div>
        <h3 class="feature-title">개발자 모드</h3>
        <p class="feature-meta">인증 후 사용할 수 있습니다.</p>
      </div>
      ${player.devModeEnabled ? '<span class="pill green">활성화</span>' : '<span class="pill">비활성화</span>'}
    </div>
    <div class="row" style="margin-top:16px;">
      ${player.devModeEnabled ? `<button class="btn danger" data-action="disable-dev-mode">개발자모드 비활성화</button>` : `<button class="btn primary" data-action="open-dev-auth">개발자모드 버튼</button>`}
    </div>
    ${player.devModeEnabled ? `
      <div class="dev-grid" style="margin-top:16px;">
        <button class="btn secondary" data-action="dev-adjust" data-field="gold" data-value="5000">골드 +5000</button>
        <button class="btn secondary" data-action="dev-adjust" data-field="rankedPointsControl" data-value="50">컨트롤 포인트 +50</button>
        <button class="btn secondary" data-action="dev-adjust" data-field="rankedPointsAuto" data-value="50">오토 포인트 +50</button>
        <button class="btn secondary" data-action="dev-adjust" data-field="kills" data-value="20">킬 +20</button>
        <button class="btn secondary" data-action="dev-adjust" data-field="damage" data-value="5000">데미지 +5000</button>
        <button class="btn secondary" data-action="dev-adjust" data-field="survivalTime" data-value="180">탱커기록 180초</button>
        <button class="btn secondary" data-action="dev-unlock-all">캐릭터 전부 해금</button>
        <button class="btn secondary" data-action="dev-pack">캐릭터팩 테스트</button>
        <button class="btn secondary" data-action="dev-reset-points">랭크 포인트 초기화</button>
      </div>` : ''}
  </div>
`;

const renderLobby = (state) => {
  const player = enrichPlayer(state.activePlayer || {});
  player.inventory = player.inventory || {};
  player.items = player.items || {};
  player.ownedCharacters = player.ownedCharacters || {};
  player.stats = player.stats || {};
  const tab = state.lobbyTab || 'main';
  const tabContent = {
    main: mainTab(player),
    craft: craftTab(player),
    shop: shopTab(player, state),
    squad: squadTab(player, state),
    items: itemsTab(player),
    controlHub: controlHub(player),
    autoHub: autoHub(player),
    controlRooms: roomScreen(state, 'control'),
    autoRooms: roomScreen(state, 'auto'),
    raidRooms: roomScreen(state, 'raidCoop'),
    rankings: rankingsScreen(state),
    players: playersScreen(state),
    missions: missionsScreen(player),
    adventure: adventureScreen(player),
  }[tab] || mainTab(player);

  return `
  <div class="page-shell">
    <div class="topbar">
      <div class="profile-panel panel" style="flex:1;">
        <div class="title-row">
          <div class="profile-head">
            ${avatarMarkup(player.activeCharacter, player.logoText, 'lg')}
            <div>
              <div class="tag-row">${badge(player.title, 'green')} ${badge(player.tierControl)} ${badge(player.tierAuto)} ${badge(`팀 전투력 ${Number(player.teamBattlePower || getTeamPower(player)).toLocaleString()}`, 'gold')}</div>
              <h2 class="profile-name">${escapeHtml(player.nickname)} <span class="inline-gold">${Number(player.gold || 0).toLocaleString()}G</span></h2>
            </div>
          </div>
          <button class="settings-btn" data-action="open-settings" title="환경설정">⚙</button>
        </div>
      </div>
    </div>
    <div class="lobby-layout">
      <aside class="side-nav">
        <div class="panel">
          <div class="nav-icon-grid">
            <button class="nav-icon-btn ${tab === 'craft' ? 'active' : ''}" data-action="set-lobby-tab" data-tab="craft"><img src="assets/ui/craft.png" alt=""><span>제작소</span></button>
            <button class="nav-icon-btn ${tab === 'shop' ? 'active' : ''}" data-action="set-lobby-tab" data-tab="shop"><img src="assets/ui/market.png" alt=""><span>상점</span></button>
            <button class="nav-icon-btn ${tab === 'main' ? 'active' : ''}" data-action="set-lobby-tab" data-tab="main"><img src="assets/ui/home.png" alt=""><span>메인</span></button>
            <button class="nav-icon-btn ${tab === 'squad' ? 'active' : ''}" data-action="set-lobby-tab" data-tab="squad"><img src="assets/ui/squad.png" alt=""><span>스쿼드</span></button>
            <button class="nav-icon-btn ${tab === 'items' ? 'active' : ''}" data-action="set-lobby-tab" data-tab="items"><img src="assets/ui/bag.png" alt=""><span>아이템</span></button>
          </div>
        </div>
        <div class="panel stack">
          ${renderDevPanel(player)}
        </div>
      </aside>
      <main class="panel content-panel">${tabContent}</main>
    </div>
  </div>`;
};





const renderFriendlyRoomLobbyModal = (modal, state) => {
  const room = modal.room || {};
  const player = enrichPlayer(state.activePlayer || {});
  const owned = player.ownedCharacterObjects || [];
  const myPlayerId = state.activePlayer?.id || '';
  const isHost = !!myPlayerId && room.hostPlayerId === myPlayerId;
  const isGuest = !!myPlayerId && room.guestPlayerId === myPlayerId && !isHost;
  const mySelected = isHost ? room.hostCharacterId : room.guestCharacterId;
  const hostChar = CHARACTER_MAP[room.hostCharacterId];
  const guestChar = CHARACTER_MAP[room.guestCharacterId];
  return `
  <div class="modal-overlay" data-close-modal="true">
    <div class="modal wide" onclick="event.stopPropagation()">
      <div class="title-row">
        <div>
          <h3 class="modal-title">${escapeHtml(room.mode === 'auto' ? '오토 친선방' : '컨트롤 친선방')}</h3>
          <p class="modal-body">${escapeHtml(room.hostNickname || '-')}의 방 · ${room.wager || 0}G</p>
        </div>
        ${badge(isHost ? '내 역할: 호스트' : isGuest ? '내 역할: 게스트' : '입장 가능', isHost ? 'gold' : 'green')}
      </div>

      <div class="grid-2" style="margin-top:16px;">
        <div class="room-player-panel">
          <h4 class="feature-title">호스트</h4>
          <div class="character-head" style="margin-top:10px;">
            ${avatarMarkup(hostChar, room.hostNickname?.slice(0,2) || 'H')}
            <div>
              <h4 class="character-name">${escapeHtml(room.hostNickname || '-')}</h4>
              <p class="character-sub">${escapeHtml(hostChar?.name || '캐릭터 미선택')}</p>
            </div>
          </div>
        </div>
        <div class="room-player-panel">
          <h4 class="feature-title">게스트</h4>
          <div class="character-head" style="margin-top:10px;">
            ${avatarMarkup(guestChar, room.guestNickname?.slice(0,2) || 'G')}
            <div>
              <h4 class="character-name">${escapeHtml(room.guestNickname || '대기중')}</h4>
              <p class="character-sub">${room.guestReady ? '준비완료' : escapeHtml(guestChar?.name || '캐릭터 미선택')}</p>
            </div>
          </div>
        </div>
      </div>

      <h4 class="feature-title" style="margin-top:18px;">캐릭터 선택</h4>
      <div class="room-select-grid" style="margin-top:10px;">
        ${owned.map((character) => `
          <button class="room-character-select ${mySelected === character.id ? 'selected' : ''}" data-action="select-room-character" data-room-id="${room.id}" data-character-id="${character.id}">
            ${avatarMarkup(character, character.name?.slice(0,2) || '??')}
            <div class="character-name">${escapeHtml(character.name)}</div>
          </button>
        `).join('')}
      </div>

      <div class="row" style="margin-top:18px;">
        ${isHost ? `<button class="btn primary" data-action="host-start-room-battle" data-room-id="${room.id}" data-mode="${room.mode || 'control'}">게임시작</button>` : ''}
        ${isGuest ? `<button class="btn primary" data-action="guest-ready-room" data-room-id="${room.id}">${room.guestReady ? '준비완료됨' : '준비완료'}</button>` : ''}
        <button class="btn secondary" data-action="close-modal">닫기</button>
      </div>
    </div>
  </div>`;
};

const renderSettingsModal = (player) => `
  <div class="modal-overlay" data-close-modal="true">
    <div class="modal" onclick="event.stopPropagation()">
      <h3 class="modal-title">환경설정</h3>
      <div class="stack" style="margin-top:16px;">
        <div class="input-group">
          <label class="label">볼륨</label>
          <select id="settings-volume" class="select-input">
            ${[0, 0.1, 0.3, 0.5, 1].map((v) => `<option value="${v}" ${Number(player?.settings?.volume ?? APP_CONFIG.defaultVolume) === v ? 'selected' : ''}>${Math.round(v * 100)}%</option>`).join('')}
          </select>
        </div>
        <div class="input-group">
          <label class="label">닉네임 변경</label>
          <input id="settings-nickname" class="text-input" maxlength="${APP_CONFIG.nicknameMax}" value="${escapeHtml(player?.nickname || '')}" />
        </div>
        <div class="row">
          <button class="btn primary" data-action="save-settings">저장</button>
          <button class="btn secondary" data-action="close-modal">닫기</button>
        </div>
        <div class="feature-card" style="margin-top:10px;">
          <h4 class="feature-title">계정 / 플레이어</h4>
          <div class="row" style="margin-top:10px;">
            <button class="btn secondary" data-action="back-player-select">플레이어 선택</button>
            <button class="btn secondary" data-action="logout">로그아웃</button>
          </div>
        </div>
      </div>
    </div>
  </div>`;


const renderDeleteModal = (playerId) => `
  <div class="modal-overlay" data-close-modal="true">
    <div class="modal" onclick="event.stopPropagation()">
      <h3 class="modal-title">플레이어 삭제</h3>
      <p class="modal-body">해당 플레이어만 삭제됩니다. 계정 자체는 삭제되지 않습니다. 계정 비밀번호를 입력하세요.</p>
      <div class="stack" style="margin-top:16px;">
        <input id="delete-player-password" class="text-input" type="password" placeholder="계정 비밀번호 입력" />
        <div class="row">
          <button class="btn danger" data-action="confirm-delete-player" data-player-id="${playerId}">삭제 확인</button>
          <button class="btn secondary" data-action="close-modal">취소</button>
        </div>
      </div>
    </div>
  </div>`;

const renderDevAuthModal = () => `
  <div class="modal-overlay" data-close-modal="true">
    <div class="modal" onclick="event.stopPropagation()">
      <h3 class="modal-title">개발자모드 인증</h3>
      <p class="modal-body">개발자 모드를 활성화하려면 인증 코드를 입력하세요.</p>
      <div class="stack" style="margin-top:16px;">
        <input id="dev-pin" class="text-input" type="password" placeholder="인증 코드 입력" />
        <div class="row">
          <button class="btn primary" data-action="confirm-dev-mode">활성화</button>
          <button class="btn secondary" data-action="close-modal">취소</button>
        </div>
      </div>
    </div>
  </div>`;

const renderCreateRoomModal = (mode) => `
  <div class="modal-overlay" data-close-modal="true">
    <div class="modal" onclick="event.stopPropagation()">
      <h3 class="modal-title">${mode === 'control' ? '컨트롤' : mode === 'raidCoop' ? '협동 레이드' : '오토'} 방 생성</h3>
      <p class="modal-body">${mode === 'raidCoop' ? '협동 레이드는 보스 타입을 선택해서 방을 만들 수 있습니다.' : '경기당 골드 배팅 금액을 설정할 수 있습니다.'}</p>
      <div class="stack" style="margin-top:16px;">
        ${mode === 'raidCoop' ? `
          <select id="room-boss-type" class="text-input">
            <option value="diablo">디아블로</option>
            <option value="godzilla">고질라</option>
          </select>
        ` : ''}
        <input id="room-wager" class="text-input" type="number" min="0" step="1" value="${mode === 'raidCoop' ? 0 : 10}" placeholder="배팅 골드" />
        <div class="row">
          <button class="btn primary" data-action="confirm-create-room" data-mode="${mode}">방 생성</button>
          <button class="btn secondary" data-action="close-modal">취소</button>
        </div>
      </div>
    </div>
  </div>`;

const renderPackModal = (character) => `
  <div class="modal-overlay" data-close-modal="true">
    <div class="modal" onclick="event.stopPropagation()">
      <h3 class="modal-title">캐릭터팩 개봉</h3>
      <div class="pack-stage">
        <div class="pack-box">PACK</div>
        <p class="modal-body">캐릭터팩이 열리며 랜덤 캐릭터를 획득했습니다.</p>
        <div class="pack-reveal">
          ${avatarMarkup(character, character.englishName.slice(0,2), 'lg')}
          <h3 style="margin:14px 0 6px;">${escapeHtml(character.name)}</h3>
          <div class="tag-row" style="justify-content:center;">${badge(character.rarity, 'green')} ${badge(character.ultimate.name)}</div>
        </div>
      </div>
      <div class="row" style="margin-top:18px; justify-content:center;">
        <button class="btn primary" data-action="close-modal">확인</button>
      </div>
    </div>
  </div>`;



const renderLiveBattle = (player, mode = 'control') => {
  const isControlLike = ['control', 'friendly', 'raidSoloDiablo', 'raidSoloGodzilla', 'raidCoop'].includes(mode);
  const isAutoLike = ['auto', 'dungeon'].includes(mode);
  const title = mode === 'control' ? '컨트롤 실시간 배틀'
    : mode === 'dungeon' ? '던전'
    : mode === 'friendly' ? '친선경기'
    : mode === 'raidSoloDiablo' ? '보스 레이드 · 디아블로'
    : mode === 'raidSoloGodzilla' ? '보스 레이드 · 고질라'
    : mode === 'raidCoop' ? '협동 보스 레이드'
    : '오토 실시간 배틀';
  return `
  <div class="live-battle-shell">
    <div class="live-battle-top">
      <div class="row center">
        <span id="battle-status" class="pill green">${escapeHtml(title)}</span>
        <span class="pill">시간 <strong id="battle-timer">0:00</strong></span>
        <span class="pill">${mode === 'raidCoop' ? '2인 협동' : mode.startsWith('raidSolo') ? '2대1' : isControlLike ? '1대1' : '2대2'}</span>
      </div>
      <button class="btn secondary small" data-battle-exit="true" data-action="exit-live-battle">나가기</button>
    </div>

    <div id="live-battle-root" class="live-battle-main" data-mode="${mode}">
      <aside class="live-battle-side">
        <div id="friend-hud"></div>
      </aside>

      <main class="live-battle-canvas-wrap">
        <canvas id="battle-canvas"></canvas>
      </main>

      <aside class="live-battle-side">
        <div id="enemy-hud"></div>
      </aside>

      <div class="live-battle-bottom">
        ${isControlLike ? `
          <div class="live-stick-wrap">
            <div id="battle-joystick">
              <div id="battle-joystick-knob"></div>
            </div>
          </div>
        ` : `<div class="live-stick-wrap"></div>`}

        <div class="live-hud-center">
          <div id="battle-log" class="logs battle-log-hidden"></div>
        </div>

        ${isControlLike ? `
          <div class="live-buttons-wrap">
            <div class="live-skill-pad">
              <button data-battle-skill="true"><span>${escapeHtml(player.activeCharacter?.skill1?.name || '스킬1')}</span><small>0%</small></button>
              <button data-battle-blink="true"><span>점멸</span><small>준비완료</small></button>
              ${(player.activeCharacter?.attackType !== 'projectile' && (mode === 'control' || mode === 'friendly' || mode.startsWith('raid'))) ? `<button class="wide" data-battle-ghost="true"><span>유체화</span><small>준비완료</small></button>` : ``}
            </div>
          </div>
        ` : `<div class="live-buttons-wrap"></div>`}
      </div>

      <div id="battle-result-overlay" class="modal-overlay result-overlay">
        <div class="result-box" onclick="event.stopPropagation()">
          <div class="title-row">
            <h2 id="battle-result-title" class="page-title">경기 결과</h2>
            <button class="btn secondary small" data-action="exit-live-battle">닫기</button>
          </div>
          <div id="battle-result-stats" class="stack" style="margin-top:12px;"></div>
        </div>
      </div>
    </div>
  </div>`;
};

const renderItemPackResultModal = (item, pack) => `
  <div class="modal-overlay" data-close-modal="true">
    <div class="modal" onclick="event.stopPropagation()">
      <h3 class="modal-title">${escapeHtml(pack?.name || '아이템 팩')} 개봉</h3>
      <div class="pack-stage">
        <div class="pack-box">${pack?.rarity === '에픽' ? 'EPIC' : 'ITEM'}</div>
        <p class="modal-body">아이템 팩에서 아래 아이템을 획득했습니다.</p>
        <div class="pack-reveal">
          <div style="display:flex;justify-content:center;">${itemIconMarkup(item)}</div>
          <h3 style="margin:14px 0 6px;">${escapeHtml(item?.name || '-')}</h3>
          <div class="tag-row" style="justify-content:center;">${badge(item?.rarity || '-', item?.rarity === '에픽' ? 'green' : '')}</div>
          <p class="feature-meta">${escapeHtml(getItemStatText(item))}</p>
        </div>
      </div>
      <div class="row" style="margin-top:18px; justify-content:center;">
        <button class="btn primary" data-action="close-modal">확인</button>
      </div>
    </div>
  </div>
`;


const statRows = ['hp', 'attack', 'attackSpeed', 'speed', 'critChance'];

const renderCharacterInfoModal = (characterId) => {
  const character = CHARACTER_MAP[characterId];
  if (!character) return '';
  return `
  <div class="modal-overlay" data-close-modal="true">
    <div class="modal wide" onclick="event.stopPropagation()">
      <h3 class="modal-title">${escapeHtml(character.name)} 정보</h3>
      <div class="grid-2" style="margin-top:16px;">
        <div class="feature-card">
          <div class="character-head">
            ${avatarMarkup(character, character.englishName?.slice(0,2) || '??', 'lg')}
            <div>
              <h3 class="character-name">${escapeHtml(character.name)}</h3>
              <p class="character-sub">${escapeHtml(character.role)} · ${escapeHtml(character.rarity)} · ${escapeHtml(character.attackType)}</p>
            </div>
          </div>
          <div class="tag-row" style="margin-top:14px;">
            ${badge(`가격 ${character.shopPrice}G`, 'gold')}
            ${badge(`평타 ${character.attackType === 'projectile' ? '원거리 투사체' : '근접 접촉'}`)}
          </div>
        </div>
        <div class="feature-card">
          <h4 class="feature-title">기본 능력치</h4>
          <table class="table">
            <tbody>
              ${statRows.map((key) => `<tr><th>${getStatLabel(key)}</th><td>${character.baseStats[key]}${key === 'critChance' ? '%' : ''}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="grid-2" style="margin-top:16px;">
        <div class="skill-chip"><div class="skill-icon">${character.skill1?.image ? `<img src="${character.skill1.image}" onerror="this.remove()" />` : ''}</div><div><strong>스킬1: ${escapeHtml(character.skill1?.name || '-')}</strong><div class="inline-note">${escapeHtml(character.skill1?.description || '')}</div></div></div>
        <div class="skill-chip"><div class="skill-icon">${character.ultimate?.image ? `<img src="${character.ultimate.image}" onerror="this.remove()" />` : ''}</div><div><strong>궁극기: ${escapeHtml(character.ultimate?.name || '-')}</strong><div class="inline-note">${escapeHtml(character.ultimate?.description || '')}</div></div></div>
      </div>
      <div class="feature-card" style="margin-top:16px;">
        <h4 class="feature-title">전투 수치</h4>
        <div class="stat-grid">
          ${statCard('투사체 속도', character.battle?.projectileSpeed || 0)}
          ${statCard('벽 튕김', character.battle?.projectileBounce || 0)}
          ${statCard('평타 쿨타임', `${character.battle?.autoAttackCooldownMs || 0}ms`)}
          ${statCard('궁극기 자동 발동', `${BATTLE_NUMBERS.ultimateAutoFireEverySeconds}s`)}
        </div>
      </div>
      <div class="row" style="margin-top:18px;">
        <button class="btn primary" data-action="toggle-compare" data-character-id="${character.id}">비교 선택/해제</button>
        <button class="btn secondary" data-action="close-modal">닫기</button>
      </div>
    </div>
  </div>`;
};

const renderCompareModal = (characterIds = []) => {
  const selected = characterIds.map((id) => CHARACTER_MAP[id]).filter(Boolean).slice(0, 3);
  const max = {};
  statRows.forEach((key) => {
    max[key] = Math.max(...selected.map((c) => Number(c.baseStats[key] || 0)));
  });
  return `
  <div class="modal-overlay" data-close-modal="true">
    <div class="modal wide" onclick="event.stopPropagation()">
      <h3 class="modal-title">캐릭터 능력치 비교</h3>
      <p class="modal-body">최대 3명까지 비교할 수 있으며, 가장 높은 능력치는 주황색으로 표시됩니다.</p>
      <table class="table" style="margin-top:16px;">
        <thead>
          <tr>
            <th>능력치</th>
            ${selected.map((c) => `<th>${escapeHtml(c.name)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${statRows.map((key) => `
            <tr>
              <th>${getStatLabel(key)}</th>
              ${selected.map((c) => {
                const value = Number(c.baseStats[key] || 0);
                const high = value === max[key];
                return `<td style="${high ? 'color:#f5a524;font-weight:900;' : ''}">${value}${key === 'critChance' ? '%' : ''}</td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="row" style="margin-top:18px;">
        <button class="btn ghost" data-action="clear-compare">비교 선택 초기화</button>
        <button class="btn secondary" data-action="close-modal">닫기</button>
      </div>
    </div>
  </div>`;
};

const renderPlayerInfoModal = (profile) => {
  const active = CHARACTER_MAP[profile.activeCharacterId];
  const squad = (profile.autoSquad || []).map((id) => CHARACTER_MAP[id]).filter(Boolean);
  const titles = Object.keys(profile.acquiredTitles || {});
  const owned = Object.keys(profile.ownedCharacters || {}).map((id) => CHARACTER_MAP[id]).filter(Boolean);
  return `
  <div class="modal-overlay" data-close-modal="true">
    <div class="modal wide" onclick="event.stopPropagation()">
      <div class="title-row">
        <div>
          <h3 class="modal-title">${escapeHtml(profile.nickname || '-')} 정보</h3>
          <p class="modal-body">${titleBadge(profile.title || '-')} · 팀가치 ${Number(profile.teamValue || 0).toLocaleString()}</p><div class="tag-row">${tierBadge(getTierFromPoints(profile.stats?.rankedPointsControl || 0), profile.stats?.rankedPointsControl || 0)} ${tierBadge(getTierFromPoints(profile.stats?.rankedPointsAuto || 0), profile.stats?.rankedPointsAuto || 0)}</div>
        </div>
        ${avatarMarkup(active, profile.logoText || profile.nickname?.slice(0,2) || '??', 'lg')}
      </div>
      <div class="grid-2" style="margin-top:16px;">
        <div class="feature-card">
          <h4 class="feature-title">스쿼드</h4>
          <div class="stack" style="margin-top:12px;">
            <div class="skill-chip"><div class="skill-icon">${active?.image ? `<img src="${active.image}" onerror="this.remove()" />` : ''}</div><div><strong>컨트롤 대표: ${escapeHtml(active?.name || '-')}</strong><div class="inline-note">1대1 대표 캐릭터</div></div></div>
            ${squad.map((c, i) => `<div class="skill-chip"><div class="skill-icon">${c.image ? `<img src="${c.image}" onerror="this.remove()" />` : ''}</div><div><strong>오토 ${i + 1}: ${escapeHtml(c.name)}</strong><div class="inline-note">${escapeHtml(c.role)} · ${escapeHtml(c.ultimate?.name || '')}</div></div></div>`).join('') || '<div class="empty-state">오토 스쿼드 정보 없음</div>'}
          </div>
        </div>
        <div class="feature-card">
          <h4 class="feature-title">전투 통계</h4>
          <div class="stat-grid">
            ${statCard('킬', profile.stats?.kills || 0)}
            ${statCard('데미지', profile.stats?.damage || 0)}
            ${statCard('탱커 기록', `${profile.stats?.survivalTime || 0}s`)}
            ${statCard('경쟁전 승', profile.stats?.rankedWins || 0)}
          </div>
        </div>
      </div>
      <div class="grid-2" style="margin-top:16px;">
        <div class="feature-card">
          <h4 class="feature-title">획득 칭호</h4>
          <div class="tag-row" style="margin-top:12px;">${titles.length ? titles.map((title) => badge(title, title === profile.title ? 'green' : '')).join('') : badge('칭호 없음')}</div>
        </div>
        <div class="feature-card">
          <h4 class="feature-title">보유 캐릭터</h4>
          <div class="tag-row" style="margin-top:12px;">${owned.length ? owned.map((c) => badge(c.name)).join('') : badge('보유 정보 없음')}</div>
        </div>
      </div>
      <div class="row" style="margin-top:18px;">
        <button class="btn secondary" data-action="close-modal">닫기</button>
      </div>
    </div>
  </div>`;
};




const renderAdventureMode = (player) => `
  <div class="adventure-shell">
    <canvas id="adventure-canvas"></canvas>

    <div class="adventure-top-ui">
      <span class="pill green">어드벤처 · 데마시아</span>
      <span id="adventure-country-state" class="pill">국가 상태 로딩</span>
      <button class="btn secondary small" data-action="exit-adventure">나가기</button>
    </div>

    <div id="adventure-panel" class="adventure-panel"></div>
    <div id="adventure-inventory" class="adventure-inventory"></div>

    <div class="adventure-joystick-wrap">
      <div id="adventure-joystick" class="adventure-joystick">
        <div id="adventure-joystick-knob" class="adventure-joystick-knob"></div>
      </div>
    </div>

    <div class="adventure-bottom-ui">
      <button class="btn primary" data-adventure-action="run">달리기</button>
      <button class="btn secondary" data-adventure-action="attack">공격</button>
      <button class="btn secondary" data-adventure-action="pickup">줍기</button>
      <button class="btn secondary" data-adventure-action="chop">벌목</button>
      <button class="btn secondary" data-adventure-action="mine">채굴</button>
      <button class="btn primary" data-adventure-action="craft">제작</button>
      <button class="btn secondary" data-adventure-action="build-wall">벽</button>
      <button class="btn secondary" data-adventure-action="build-door">문</button>
      <button class="btn secondary" data-adventure-action="build-house">백성 집</button>
      <button class="btn secondary" data-adventure-action="craft-car">자동차</button>
      <button class="btn secondary" data-adventure-action="craft-boat">보트</button>
      <button class="btn secondary" data-adventure-action="build-castle">성</button>
    </div>
  </div>`;


export const render = (state = {}) => {
  const screen = state.screen || 'loading';
  if (screen === 'loading') {
    return `
      <div class="center-shell">
        <div class="auth-card card">
          <h1 class="brand-title">${APP_CONFIG.gameName}</h1>
          <p class="brand-sub">로딩 중...</p>
        </div>
      </div>`;
  }
  if (screen === 'first') return renderFirstScreen();
  if (screen === 'login') return renderAuthForm('login', state);
  if (screen === 'signup') return renderAuthForm('signup', state);
  if (screen === 'playerSelect') return renderPlayerSelect(state);
  if (screen === 'prep') return renderPrepScreen(state);
  if (screen === 'lobby') return renderLobby(state);
  if (screen === 'liveBattle') return renderLiveBattle(state.activePlayer || {}, state.liveBattleMode || 'control');
  if (screen === 'adventureMode') return renderAdventureMode(state.activePlayer || {});
  if (screen === 'battlePreview') return renderLobby(state);
  return renderFirstScreen();
};

export const renderModal = (modal, state = {}) => {
  if (!modal) return '';
  if (modal.type === 'friendlyRoomLobby') return renderFriendlyRoomLobbyModal(modal, state);
  if (modal.type === 'settings') return renderSettingsModal(modal.player);
  if (modal.type === 'deletePlayer') return renderDeleteModal(modal.playerId);
  if (modal.type === 'devAuth') return renderDevAuthModal();
  if (modal.type === 'createRoom') return renderCreateRoomModal(modal.mode);
  if (modal.type === 'packResult') return renderPackModal(modal.character);
  if (modal.type === 'characterInfo') return renderCharacterInfoModal(modal.characterId);
  if (modal.type === 'compareCharacters') return renderCompareModal(modal.characterIds);
  if (modal.type === 'playerInfo') return renderPlayerInfoModal(modal.profile);
  if (modal.type === 'itemPackContents') return renderItemPackContentsModal(modal.packType);
  if (modal.type === 'itemPackResult') return renderItemPackResultModal(modal.item, modal.pack);
  return '';
};
