// ═══════════════════════════════════════════
// Config & State
// ═══════════════════════════════════════════
const API = '/api';
let session  = JSON.parse(localStorage.getItem('ri_session') || 'null');
let appData  = {};
let mapInst  = null;
let mapMarkers = [];

// ═══════════════════════════════════════════
// API Helper
// ═══════════════════════════════════════════
async function apiFetch(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (session?.token) headers['Authorization'] = `Bearer ${session.token}`;
  try {
    const res = await fetch(API + path, { headers, ...opts });
    return await res.json();
  } catch (e) { return { detail: '無法連線後端' }; }
}

// ═══════════════════════════════════════════
// Boot
// ═══════════════════════════════════════════
window.onload = async () => {
  if (session?.token) {
    const chk = await apiFetch('/auth/check');
    if (chk.valid) {
      session.is_test_user = chk.is_test_user;
      await loadAppData();
      showPage('page-app');
      return;
    }
    localStorage.removeItem('ri_session');
    session = null;
  }
  showPage('page-auth');
};

// ═══════════════════════════════════════════
// Page / Nav
// ═══════════════════════════════════════════
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('on'));
  document.getElementById(id)?.classList.add('on');
}

function go(id) {
  document.querySelectorAll('.scr').forEach(s => s.classList.remove('on'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('on'));
  document.getElementById('scr-' + id)?.classList.add('on');
  document.getElementById('t-' + id)?.classList.add('on');
  if (id === 'map')     initLeafletMap();
  if (id === 'route')   loadRecommendRoutes();
  if (id === 'rank')    loadLeaderboard();
  if (id === 'achieve') loadAchievements();
  if (id === 'mission') loadMissions();
}

// ═══════════════════════════════════════════
// Auth Tab
// ═══════════════════════════════════════════
function switchAuthTab(tab) {
  ['login','register'].forEach(t => {
    document.getElementById('tab-' + t)?.classList.toggle('on', t === tab);
    document.getElementById('form-' + t).style.display = t === tab ? 'block' : 'none';
  });
  clearErrors();
}

function clearErrors() {
  document.querySelectorAll('.form-error').forEach(e => { e.textContent = ''; e.classList.remove('on'); });
  document.querySelectorAll('.form-input').forEach(e => e.classList.remove('err'));
}

function setFieldErr(inputId, errId, msg) {
  document.getElementById(inputId)?.classList.add('err');
  const el = document.getElementById(errId);
  if (el) { el.textContent = msg; el.classList.add('on'); }
}

function togglePw(inputId, btn) {
  const inp = document.getElementById(inputId);
  inp.type = inp.type === 'text' ? 'password' : 'text';
  btn.className = `toggle-pw ti ti-eye${inp.type === 'text' ? '-off' : ''}`;
}

function fillTest() {
  document.getElementById('login-username').value = 'testuser';
  document.getElementById('login-password').value = '123456';
}

// ═══════════════════════════════════════════
// Login
// ═══════════════════════════════════════════
async function doLogin() {
  clearErrors();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  if (!username) { setFieldErr('login-username','login-username-err','請輸入帳號'); return; }
  if (!password)  { setFieldErr('login-password','login-pw-err','請輸入密碼'); return; }

  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> 登入中...';

  const data = await apiFetch('/auth/login', { method:'POST', body:JSON.stringify({username,password}) });
  btn.disabled = false;
  btn.innerHTML = '<i class="ti ti-login"></i> 登入';

  if (data.token) {
    session = { token:data.token, username:data.username, display_name:data.display_name, easycard_id:data.easycard_id };
    localStorage.setItem('ri_session', JSON.stringify(session));
    const chk = await apiFetch('/auth/check');
    session.is_test_user = chk.is_test_user;
    await showWelcome(data, false);
  } else {
    const errEl = document.getElementById('login-global-err');
    if (errEl) { errEl.textContent = data.detail || '登入失敗'; errEl.classList.add('on'); }
  }
}

// ═══════════════════════════════════════════
// Register
// ═══════════════════════════════════════════
async function doRegister() {
  clearErrors();
  const username = document.getElementById('reg-username').value.trim();
  const display  = document.getElementById('reg-display').value.trim();
  const card     = document.getElementById('reg-card').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm  = document.getElementById('reg-confirm').value;

  let ok = true;
  if (username.length < 2) { setFieldErr('reg-username','reg-username-err','至少 2 字元'); ok=false; }
  if (!display)             { setFieldErr('reg-display','reg-display-err','請輸入顯示名稱'); ok=false; }
  if (card.length < 4)      { setFieldErr('reg-card','reg-card-err','請輸入有效悠遊卡號'); ok=false; }
  if (password.length < 6)  { setFieldErr('reg-password','reg-pw-err','密碼至少 6 字元'); ok=false; }
  if (password !== confirm)  { setFieldErr('reg-confirm','reg-confirm-err','兩次密碼不一致'); ok=false; }
  if (!ok) return;

  const btn = document.getElementById('register-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> 建立中...';

  const data = await apiFetch('/auth/register', {
    method:'POST',
    body: JSON.stringify({ username, display_name:display, easycard_id:card, password })
  });
  btn.disabled = false;
  btn.innerHTML = '<i class="ti ti-user-plus"></i> 建立帳號';

  if (data.token) {
    session = { token:data.token, username:data.username, display_name:data.display_name, easycard_id:data.easycard_id, is_test_user:false };
    localStorage.setItem('ri_session', JSON.stringify(session));
    await showWelcome(data, true);
  } else {
    const errEl = document.getElementById('reg-global-err');
    if (errEl) { errEl.textContent = data.detail || '註冊失敗'; errEl.classList.add('on'); }
  }
}

// ═══════════════════════════════════════════
// Welcome Screen
// ═══════════════════════════════════════════
async function showWelcome(authData, isNew) {
  setText('w-name', authData.display_name);
  setText('w-msg', isNew ? '帳號建立成功！歡迎加入軌道印記 🎉' : `歡迎回來！`);
  setText('w-card', authData.easycard_id);
  const me = await apiFetch('/auth/me');
  const st = await apiFetch(`/stamps/${authData.easycard_id}`);
  setText('w-pts',    me.points || 0);
  setText('w-stamps', st.total_collected || 0);
  setText('w-co2',    parseFloat(me.total_co2_kg || 0).toFixed(1));
  showPage('page-welcome');
}

async function goToApp() {
  await loadAppData();
  showPage('page-app');
}

// ═══════════════════════════════════════════
// Load All App Data
// ═══════════════════════════════════════════
async function loadAppData() {
  if (!session) return;
  const [me, stamps, pts] = await Promise.all([
    apiFetch('/auth/me'),
    apiFetch(`/stamps/${session.easycard_id}`),
    apiFetch(`/points/${session.easycard_id}`),
  ]);
  appData = { me, stamps, pts };
  session.is_test_user = me.is_test_user || session.is_test_user;
  renderApp();
}

// ═══════════════════════════════════════════
// Render App
// ═══════════════════════════════════════════
function renderApp() {
  const me    = appData.me    || {};
  const stamps= appData.stamps|| {};
  const pts   = appData.pts   || {};
  const isTest= session?.is_test_user || false;

  // Topbar
  setText('topbar-username', session?.display_name || '');
  const badge = document.getElementById('test-badge-topbar');
  if (badge) badge.style.display = isTest ? 'inline-block' : 'none';

  // Home greeting
  const hr = new Date().getHours();
  const gr = hr < 12 ? '早安' : hr < 18 ? '午安' : '晚安';
  setText('home-greeting', `${gr}，${session?.display_name || '旅人'}！`);

  // Points
  const bal = pts.balance ?? me.points ?? 0;
  setText('ui-points',    bal.toLocaleString());
  setText('ui-pts-big',   bal.toLocaleString());
  setText('ui-rides',     me.monthly_trips || 0);
  setText('ui-carbon',    parseFloat(me.total_co2_kg || 0).toFixed(1));
  setText('ui-co2',       parseFloat(me.total_co2_kg || pts.total_co2_kg || 0).toFixed(1));
  setText('ui-km',        parseFloat(pts.total_km || me.total_km || 0).toFixed(0));

  // Tap card — testuser only
  const tapCard = document.getElementById('tap-card');
  const tapHint = document.getElementById('tap-hint');
  if (tapCard) {
    if (isTest) {
      tapCard.classList.remove('disabled-tap');
      tapCard.onclick = openTapModal;
      if (tapHint) tapHint.textContent = '點擊模擬進站 (測試帳號)';
    } else {
      tapCard.classList.add('disabled-tap');
      tapCard.onclick = () => showToast('模擬進站僅限測試帳號使用', false);
      if (tapHint) tapHint.textContent = '實際上線後刷卡觸發';
    }
  }

  // Stamps
  const allSt  = stamps.stamps || [];
  const unlocked = allSt.filter(s => s.is_unlocked);
  const total  = allSt.length || 25;
  setText('ui-stamp-count', unlocked.length);
  setText('stamp-collected', unlocked.length);
  setText('stamp-total', total);
  setWidth('stamp-prog', unlocked.length, total);
  setWidth('prog-line', unlocked.length, total);
  setText('prog-line-cnt', `${unlocked.length}/${total}`);
  setText('prog-line-hint', unlocked.length < total ? `再集 ${total - unlocked.length} 枚` : '🎉 全線制霸！');

  renderStampGrid(allSt);

  // Profile
  setText('p-name',     session?.display_name || '—');
  setText('p-card',     session?.easycard_id  || '—');
  setText('p-card2',    session?.easycard_id  || '—');
  setText('p-username', session?.username     || '—');
  setText('p-pts',      bal.toLocaleString());
  setText('p-stamps',   unlocked.length);
  setText('p-rides',    me.total_rides || 0);
  setText('p-co2',      parseFloat(me.total_co2_kg || 0).toFixed(1));
  const av = document.getElementById('p-avatar');
  if (av && session?.display_name) av.textContent = session.display_name[0];
  const testBadge = document.getElementById('p-test-badge');
  if (testBadge) testBadge.style.display = isTest ? 'inline-block' : 'none';
}

// ═══════════════════════════════════════════
// Stamp Grid
// ═══════════════════════════════════════════
const RARITY_COLOR = { legendary:'ic-r', rare:'ic-o', common:'ic-b' };
const RARITY_LABEL = { legendary:'傳說', rare:'稀有', common:'普通' };

function renderStampGrid(allSt) {
  const unlocked = allSt.filter(s => s.is_unlocked);
  const locked   = allSt.filter(s => !s.is_unlocked);

  function stampHTML(s, isLocked) {
    const vc = s.visit_count > 1 ? `<div class="stamp-visits">已到訪 ${s.visit_count} 次</div>` : '';
    return `<div class="stamp${isLocked ? ' locked' : ''}">
      <div class="stamp-icon ${RARITY_COLOR[s.rarity]||'ic-b'}">${s.icon||'🏷️'}</div>
      <div class="stamp-nm">${s.station_name}</div>
      <div class="stamp-ds">${s.line}</div>
      <span class="badge ${isLocked ? 'bg-k' : 'bg-g'}">${isLocked ? '🔒 '+RARITY_LABEL[s.rarity] : '✓ 已收集'}</span>
      ${vc}
    </div>`;
  }

  const ug = document.getElementById('stamp-unlocked-grid');
  const lg = document.getElementById('stamp-locked-grid');
  if (ug) ug.innerHTML = unlocked.length
    ? unlocked.map(s => stampHTML(s, false)).join('')
    : '<div style="grid-column:span 2;text-align:center;padding:20px;color:#aaa;font-size:12px">快去搭車解鎖第一枚印章！</div>';
  if (lg) lg.innerHTML = locked.map(s => stampHTML(s, true)).join('');
}

// ═══════════════════════════════════════════
// Leaflet Map
// ═══════════════════════════════════════════
async function initLeafletMap() {
  if (mapInst) return;
  const container = document.getElementById('leaflet-map');
  if (!container || typeof L === 'undefined') return;

  mapInst = L.map('leaflet-map', { zoomControl:false, attributionControl:false })
             .setView([25.05, 121.5], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInst);

  const data = await apiFetch('/stations');
  const stations = data.stations || [];
  const userStamps = (appData.stamps?.stamps || []);
  const ownedCodes = new Set(userStamps.filter(s => s.is_unlocked).map(s => s.station_code));

  stations.forEach(st => {
    const owned = ownedCodes.has(st.code);
    const color = st.rarity === 'legendary' ? '#e03131' : st.rarity === 'rare' ? '#f08c00' : '#1a5fb4';
    const circle = L.circleMarker([st.lat, st.lng], {
      radius: st.rarity === 'legendary' ? 10 : st.rarity === 'rare' ? 8 : 6,
      fillColor: owned ? color : '#ccc',
      color: color,
      weight: 2,
      fillOpacity: owned ? 0.9 : 0.5,
    }).addTo(mapInst);

    circle.on('click', () => showMapStation(st, owned));
    mapMarkers.push(circle);
  });
}

function showMapStation(st, owned) {
  const rarityTag = { legendary:'tag-legend', rare:'tag-rare', common:'tag-common' }[st.rarity] || 'tag-common';
  const rarityLabel = RARITY_LABEL[st.rarity] || st.rarity;
  const isTest = session?.is_test_user;

  document.getElementById('map-info').innerHTML = `
    <div class="st-card">
      <div class="st-header">
        <div class="st-icon-big">${st.icon}</div>
        <div>
          <div class="st-name">${st.name}</div>
          <div class="st-line">${st.line}</div>
          <span class="${rarityTag}">${rarityLabel}</span>
          ${st.is_remote ? '<span class="tag-remote" style="margin-left:4px">偏遠+500</span>' : ''}
        </div>
      </div>
      <div class="st-stats">
        <div><div class="st-stat-lbl">印章狀態</div><div class="st-stat-val">${owned ? '✅ 已解鎖' : '🔒 未解鎖'}</div></div>
        <div><div class="st-stat-lbl">基本積分</div><div class="st-stat-val">+${st.base_points}${st.is_remote?' (+500)':''}</div></div>
        <div><div class="st-stat-lbl">距基隆</div><div class="st-stat-val">${st.dist_km} km</div></div>
        <div><div class="st-stat-lbl">省碳</div><div class="st-stat-val">${(st.dist_km * 0.021).toFixed(2)} kg</div></div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="sim-btn" onclick="quickTap('${st.code}')" ${isTest ? '' : 'disabled'} title="${isTest ? '' : '僅測試帳號可用'}">
          🚆 模擬進站${isTest ? '' : '（測試限定）'}
        </button>
        <button class="qr-scan-btn" onclick="openModal('scan-modal')">
          📷 掃票
        </button>
      </div>
    </div>`;
}

// ═══════════════════════════════════════════
// Simulate Tap (testuser only enforced by server)
// ═══════════════════════════════════════════
function openTapModal() {
  if (!session?.is_test_user) {
    showToast('模擬進站僅限測試帳號（testuser）使用', false);
    return;
  }
  openModal('tap-modal');
}

async function quickTap(code) {
  if (!session?.is_test_user) {
    showToast('模擬進站僅限 testuser 使用', false);
    return;
  }
  document.getElementById('tap-station').value = code;
  await doTap();
}

async function doTap() {
  closeModal('tap-modal');
  const code = document.getElementById('tap-station').value;
  showToast('嗶！Data Gate 驗證中...', true);

  const data = await apiFetch(
    `/easycard/simulate-tap?card_id=${session.easycard_id}&station_code=${code}`,
    { method:'POST' }
  );

  if (data.station) {
    const bonus = data.is_remote_bonus ? '（偏遠加碼）' : '';
    const msg = data.stamp_unlocked
      ? `🏅 新印章！${data.stamp_icon} ${data.station} +${data.points_earned} 積分${bonus}`
      : `✅ ${data.station} · +${data.points_earned} 積分 · ×${data.visit_count} 訪`;
    showToast(msg, true);

    // 成就彈窗
    if (data.new_achievements?.length) {
      data.new_achievements.forEach((ach, i) => {
        setTimeout(() => showAchievementPopup(ach), i * 1800);
      });
    }

    // 任務完成提示
    if (data.completed_missions?.length) {
      data.completed_missions.forEach((m, i) => {
        setTimeout(() => showToast(`🎯 任務完成：${m.icon} ${m.title} +${m.points_reward} 積分`, true), (data.new_achievements?.length || 0) * 1800 + i * 1500);
      });
    }

    await loadAppData();
    if (mapInst) { mapInst.remove(); mapInst = null; mapMarkers = []; }
  } else {
    showToast(data.detail || '⚠️ 連線失敗，請確認後端已啟動', false);
  }
}

// ═══════════════════════════════════════════
// Achievements
// ═══════════════════════════════════════════
async function loadAchievements() {
  const data = await apiFetch('/achievements');
  if (!data.achievements) return;

  const unlocked = data.unlocked_count || data.achievements.filter(a => a.is_unlocked).length;
  const total    = data.total || data.achievements.length;

  setText('achieve-count', `${unlocked} / ${total}`);
  setWidth('achieve-prog-fill', unlocked, total);

  const grid = document.getElementById('achieve-grid');
  if (!grid) return;
  grid.innerHTML = data.achievements.map(a => `
    <div class="achieve-card ${a.is_unlocked ? 'unlocked' : 'locked'}">
      <div class="achieve-icon">${a.icon}</div>
      <div class="achieve-name">${a.name}</div>
      <div class="achieve-pts">+${a.points} 積分</div>
      <div class="achieve-desc">${a.description}</div>
      ${a.is_unlocked ? `<div style="font-size:10px;color:#27500a;margin-top:4px">✓ ${a.unlocked_at ? new Date(a.unlocked_at).toLocaleDateString('zh-TW') : '已解鎖'}</div>` : ''}
    </div>
  `).join('');

  // Home preview (最近解鎖的 3 個)
  loadAchievementsPreview(data.achievements);
}

function loadAchievementsPreview(achievements) {
  const preview = document.getElementById('home-achievements-preview');
  if (!preview) return;
  const recent = achievements.filter(a => a.is_unlocked).slice(-3);
  if (!recent.length) {
    preview.innerHTML = '<div style="padding:8px 0;font-size:11px;color:#aaa">搭車解鎖第一個成就！</div>';
    return;
  }
  preview.innerHTML = recent.map(a => `
    <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:0.5px solid #f0f0f0">
      <span style="font-size:20px">${a.icon}</span>
      <div style="flex:1"><div style="font-size:12px;font-weight:500">${a.name}</div><div style="font-size:10px;color:#888">${a.description}</div></div>
      <span style="font-size:11px;font-weight:600;color:#0d2b6e">+${a.points}</span>
    </div>
  `).join('');
}

function showAchievementPopup(ach) {
  const pop = document.getElementById('ach-popup');
  if (!pop) return;
  document.getElementById('ach-popup-icon').textContent = ach.icon;
  document.getElementById('ach-popup-name').textContent = ach.name;
  document.getElementById('ach-popup-pts').textContent  = `+${ach.points} 積分`;
  pop.classList.add('on');
  setTimeout(() => pop.classList.remove('on'), 3500);
}

// ═══════════════════════════════════════════
// Missions
// ═══════════════════════════════════════════
async function loadMissions() {
  const data = await apiFetch('/missions');
  const missions = data.missions || [];
  const list = document.getElementById('mission-list-full');
  if (!list) return;

  const active    = missions.filter(m => !m.is_completed);
  const completed = missions.filter(m => m.is_completed);

  list.innerHTML = `
    <div class="sec-label" style="padding-top:8px">進行中（${active.length}）</div>
    ${active.map(m => missionHTML(m)).join('')}
    ${completed.length ? `<div class="sec-label">已完成（${completed.length}）</div>${completed.map(m => missionHTML(m)).join('')}` : ''}
    <div style="height:14px"></div>
  `;

  // Home preview
  const homeList = document.getElementById('home-mission-list');
  if (homeList) {
    homeList.innerHTML = missions.slice(0,3).map(m => missionHTML(m)).join('');
  }
}

function missionHTML(m) {
  const limitedBadge = m.is_limited ? `<span class="mission-limited-badge">限時</span>` : '';
  const deadline = m.is_limited && m.deadline
    ? `<div style="font-size:10px;color:#e63946;margin-top:2px">⏰ 截止 ${new Date(m.deadline).toLocaleString('zh-TW',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</div>`
    : '';
  const bg = m.is_limited ? '#faeeda' : m.is_completed ? '#eaf3de' : '#e6f1fb';

  return `<div class="mission-item${m.is_completed ? ' done' : ''}">
    <div class="mission-icon-box" style="background:${bg}">${m.icon || '🎯'}</div>
    <div style="flex:1">
      <div style="font-size:13px;font-weight:500">${m.title}${limitedBadge}</div>
      <div style="font-size:11px;color:#888;margin-top:1px">${m.description}</div>
      ${deadline}
      <span class="badge ${m.is_completed ? 'bg-g' : 'bg-b'}">${m.is_completed ? '✓ 已完成' : '+' + m.points_reward + ' 積分'}</span>
    </div>
    ${m.is_completed ? '<span class="mission-done-badge">完成 ✓</span>' : `<div class="mission-pts">+${m.points_reward}</div>`}
  </div>`;
}

// ═══════════════════════════════════════════
// Recommended Routes（推薦路線）
// ═══════════════════════════════════════════
let boardingStationCode = localStorage.getItem('ri_boarding_station') || '';
let routeStationsCache  = null; // 快取 /api/stations 結果，供上車站選單 / 定位使用

async function ensureRouteStationsCache() {
  if (routeStationsCache) return routeStationsCache;
  const data = await apiFetch('/stations');
  routeStationsCache = data.stations || [];
  return routeStationsCache;
}

function populateBoardingSelect(stations) {
  const sel = document.getElementById('route-boarding-select');
  if (!sel || sel.dataset.filled === '1') return;
  const opts = stations.map(st => `<option value="${st.code}">${st.icon || '🚉'} ${st.name}</option>`).join('');
  sel.insertAdjacentHTML('beforeend', opts);
  sel.dataset.filled = '1';
}

function onBoardingStationChange() {
  const sel = document.getElementById('route-boarding-select');
  boardingStationCode = sel ? sel.value : '';
  localStorage.setItem('ri_boarding_station', boardingStationCode);
  loadRecommendRoutes();
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function locateNearestBoardingStation() {
  if (!navigator.geolocation) { showToast('此裝置不支援定位', false); return; }
  const stations = await ensureRouteStationsCache();
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      let nearest = null, minDist = Infinity;
      stations.forEach(st => {
        const d = haversineKm(latitude, longitude, st.lat, st.lng);
        if (d < minDist) { minDist = d; nearest = st; }
      });
      if (!nearest) return;
      const sel = document.getElementById('route-boarding-select');
      if (sel) sel.value = nearest.code;
      boardingStationCode = nearest.code;
      localStorage.setItem('ri_boarding_station', boardingStationCode);
      showToast(`已定位至最近站：${nearest.name}`);
      loadRecommendRoutes();
    },
    () => showToast('無法取得定位，請改用下拉選單手動選擇', false),
    { enableHighAccuracy: false, timeout: 8000 }
  );
}

async function loadRecommendRoutes() {
  const stations = await ensureRouteStationsCache();
  populateBoardingSelect(stations);
  const sel = document.getElementById('route-boarding-select');
  if (sel) sel.value = boardingStationCode;

  const qs = boardingStationCode ? `?boarding_station=${encodeURIComponent(boardingStationCode)}` : '';
  const data = await apiFetch('/recommend-routes' + qs);
  if (data.detail) {
    document.getElementById('route-next-best').innerHTML = '';
    document.getElementById('route-smart-list').innerHTML =
      `<div style="text-align:center;padding:20px;color:#aaa;font-size:12px">${data.detail}</div>`;
    document.getElementById('route-mission-list').innerHTML = '';
    document.getElementById('route-themed-list').innerHTML = '';
    return;
  }
  const hint = document.getElementById('route-board-hint');
  if (hint) {
    hint.textContent = data.boarding_station
      ? `已依「${data.boarding_station.icon || ''} ${data.boarding_station.name}」上車，優先推薦距離近、又值得收集的站點`
      : '選擇上車站，系統會優先推薦離你較近的路線；或點右側圖示自動定位最近站';
  }
  renderNextBest(data.next_best, data.total_uncollected);
  renderSmartRoutes(data.smart_routes, data.total_uncollected);
  renderMissionRoutes(data.mission_routes);
  renderThemedRoutes(data.themed_routes);

  // 背景請求 AI 文案增強（智慧推薦路線／主題路線），不阻塞原本的靜態列表；
  // 若 AI 服務未設定或失敗，靜態文字會原樣保留。
  loadAiRouteEnrichment();
}

async function loadAiRouteEnrichment() {
  const data = await apiFetch('/ai-route-insights', {
    method: 'POST',
    body: JSON.stringify({ boarding_station: boardingStationCode || '' }),
  });
  if (!data || data.detail) return; // 靜默失敗，保留原本靜態文案

  (data.smart || []).forEach(s => {
    const card = document.querySelector(`#route-smart-list [data-smart-idx="${s.index}"]`);
    if (!card) return;
    const titleEl = card.querySelector('.route-card-title');
    if (titleEl && s.ai_title) {
      titleEl.innerHTML = `<span class="ai-tag">✨AI</span> ${s.ai_title}`;
    }
    if (s.ai_blurb) {
      const blurb = document.createElement('div');
      blurb.className = 'route-card-ai-blurb';
      blurb.textContent = `💡 ${s.ai_blurb}`;
      card.appendChild(blurb);
    }
  });

  (data.themed || []).forEach(t => {
    const card = document.querySelector(`#route-themed-list [data-themed-id="${t.id}"]`);
    if (!card || !t.ai_note) return;
    const note = document.createElement('div');
    note.className = 'route-themed-ai-note';
    note.innerHTML = `<span class="ai-tag">✨AI</span> ${t.ai_note}`;
    card.appendChild(note);
  });
}

function stationChip(st) {
  let cls = '';
  if (st.rarity === 'legendary') cls = 'r-legend';
  else if (st.rarity === 'rare') cls = 'r-rare';
  if (st.is_remote) cls += ' r-remote';
  return `<span class="route-chip ${cls}">${st.icon} ${st.name}</span>`;
}

// ═══════════════════════════════════════════
// AI 智慧路線規劃（Gemini）
// ═══════════════════════════════════════════
async function requestAiRoutePlan() {
  const btn        = document.getElementById('ai-route-btn');
  const resultBox  = document.getElementById('ai-route-result');
  const timeBudget = document.getElementById('ai-time-budget')?.value || '';
  const preference = document.getElementById('ai-preference-input')?.value?.trim() || '';
  if (!btn || !resultBox) return;

  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> AI 規劃中…';
  resultBox.innerHTML = '';

  const data = await apiFetch('/ai-route-plan', {
    method: 'POST',
    body: JSON.stringify({
      boarding_station: boardingStationCode || '',
      time_budget_minutes: timeBudget,
      preference,
    }),
  });

  renderAiRoutePlan(data);

  btn.disabled = false;
  btn.innerHTML = '<i class="ti ti-sparkles"></i> 請 AI 幫我規劃路線';
}

function renderAiRoutePlan(data) {
  const box = document.getElementById('ai-route-result');
  if (!box) return;

  if (data.all_collected) {
    box.innerHTML = `<div class="ai-route-error" style="color:#27500a;background:#eaf3de">🎉 你已收集所有站點，沒有需要規劃的路線囉！</div>`;
    return;
  }
  if (data.detail) {
    box.innerHTML = `<div class="ai-route-error">⚠️ ${data.detail}</div>`;
    return;
  }
  if (!data.stops || !data.stops.length) {
    box.innerHTML = `<div class="ai-route-error">AI 暫時無法規劃路線，請稍後再試</div>`;
    return;
  }

  const metaBits = [];
  if (data.total_distance_km) metaBits.push(`約 ${data.total_distance_km} km`);
  if (data.estimated_minutes) metaBits.push(`約 ${data.estimated_minutes} 分鐘`);
  metaBits.push(`+${data.total_points} 積分`);

  const stopsHtml = data.stops.map((s, i) => `
    <div class="ai-route-stop">
      <div class="ai-route-stop-no">${i + 1}</div>
      <div style="flex:1">
        ${stationChip(s)}
        ${s.reason ? `<div class="ai-route-stop-reason">${s.reason}</div>` : ''}
      </div>
    </div>
  `).join('');

  box.innerHTML = `
    <div class="ai-route-card">
      <div class="ai-route-card-title">✨ ${data.title}</div>
      <div class="ai-route-card-narrative">${data.narrative}</div>
      <div class="ai-route-card-meta">${metaBits.join('・')}</div>
      <div class="ai-route-stops">${stopsHtml}</div>
      ${data.tip ? `<div class="ai-route-tip">💡 ${data.tip}</div>` : ''}
    </div>
  `;
}

function directionLabel(dir) {
  return dir === 'up' ? '北上方向' : dir === 'down' ? '南下方向' : dir === 'same' ? '就在上車站' : '';
}

function renderNextBest(best, totalUncollected) {
  const box = document.getElementById('route-next-best');
  if (!best) {
    box.innerHTML = totalUncollected === 0
      ? `<div class="route-best-card">
           <div class="route-best-icon">👑</div>
           <div>
             <div class="route-best-lbl">恭喜</div>
             <div class="route-best-name">25 枚印章已全數收集！</div>
             <div class="route-best-sub">你是真正的北北基桃鐵道達人</div>
           </div>
         </div>`
      : '';
    return;
  }
  const travelLine = best.travel
    ? `<div class="route-best-sub">距上車站 ${best.travel.distance_km} km・約 ${best.travel.est_minutes} 分鐘・${directionLabel(best.travel.direction)}</div>`
    : '';
  box.innerHTML = `
    <div class="route-best-card">
      <div class="route-best-icon">${best.icon}</div>
      <div>
        <div class="route-best-lbl">今日最推薦</div>
        <div class="route-best-name">直奔 ${best.name}</div>
        <div class="route-best-sub">可獲得 ${best.points} 積分${best.is_remote ? '（含偏鄉加碼）' : ''}</div>
        ${travelLine}
      </div>
    </div>`;
}

function renderSmartRoutes(routes, totalUncollected) {
  const el = document.getElementById('route-smart-list');
  if (totalUncollected === 0) {
    el.innerHTML = `<div style="text-align:center;padding:16px;color:#aaa;font-size:12px">所有站點都已收集，沒有新路線可以推薦囉！</div>`;
    return;
  }
  if (!routes || !routes.length) {
    el.innerHTML = `<div style="text-align:center;padding:16px;color:#aaa;font-size:12px">暫無建議路線</div>`;
    return;
  }
  el.innerHTML = routes.map((r, idx) => `
    <div class="route-card" data-smart-idx="${idx}">
      <div class="route-card-hd">
        <div>
          <div class="route-card-title">${r.title}</div>
          <div class="route-card-summary">${r.summary}</div>
        </div>
        <div class="route-card-pts">+${r.total_points}</div>
      </div>
      <div class="route-chips">${r.stations.map(stationChip).join('')}</div>
      ${r.travel_summary ? `<div class="route-card-travel">🚆 ${r.travel_summary}</div>` : ''}
    </div>
  `).join('');
}

function renderMissionRoutes(routes) {
  const el = document.getElementById('route-mission-list');
  if (!routes || !routes.length) {
    el.innerHTML = `<div style="text-align:center;padding:16px;color:#aaa;font-size:12px">目前沒有進行中的任務</div>`;
    return;
  }
  el.innerHTML = routes.map(m => `
    <div class="route-card">
      <div class="route-card-hd">
        <div class="route-card-title">${m.icon} ${m.title}${m.is_limited ? ' <span class="mission-limited-badge">限時</span>' : ''}</div>
        <div class="route-card-pts">+${m.points_reward}</div>
      </div>
      ${m.stations.length ? `<div class="route-chips">${m.stations.map(stationChip).join('')}</div>` : ''}
      ${m.note ? `<div class="route-mission-note">${m.note}</div>` : ''}
    </div>
  `).join('');
}

function renderThemedRoutes(routes) {
  const el = document.getElementById('route-themed-list');
  if (!routes || !routes.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="route-themed-row">${routes.map(t => `
    <div class="route-themed-card" data-themed-id="${t.id}">
      <div class="route-themed-icon">${t.icon}</div>
      <div class="route-themed-title">${t.title}</div>
      <span class="route-themed-tag">${t.tag}</span>
      <div class="route-themed-desc">${t.desc}</div>
      <div class="route-chips">${t.stations.map(stationChip).join('')}</div>
      ${t.all_collected
        ? `<div class="route-done-badge">✓ 已完成此路線</div>`
        : `<div class="route-themed-prog">
             <div class="route-themed-prog-bar"><div class="route-themed-prog-fill" style="width:${Math.round(t.collected_count / t.total * 100)}%"></div></div>
             <div class="route-themed-prog-txt">${t.collected_count}/${t.total}</div>
           </div>`}
    </div>
  `).join('')}</div>`;
}

// ═══════════════════════════════════════════
// Leaderboard
// ═══════════════════════════════════════════
async function loadLeaderboard() {
  const data = await apiFetch('/leaderboard');
  const rows = data.leaderboard || [];
  const list = document.getElementById('rank-list');
  if (!list) return;
  const medals = ['🥇','🥈','🥉'];
  list.innerHTML = rows.map((u, i) => `
    <div class="rank-item">
      <div class="rank-medal">${medals[i] || (i+1)}</div>
      <div>
        <div class="rank-name">${u.name}</div>
        <div class="rank-sub">搭乘 ${u.total_rides} 次 · 印章 ${u.stamp_count} 枚 · 省碳 ${parseFloat(u.total_carbon_saved||0).toFixed(1)} kg</div>
      </div>
      <div class="rank-pts">${u.total_points.toLocaleString()}</div>
    </div>
  `).join('') || '<div style="text-align:center;padding:20px;color:#aaa;font-size:12px">暫無排行資料</div>';
}

// ═══════════════════════════════════════════
// Redeem
// ═══════════════════════════════════════════
async function redeem(rewardId, name, cost) {
  const bal = appData.pts?.balance ?? appData.me?.points ?? 0;
  if (bal < cost) { showToast(`❌ 積分不足，還差 ${cost - bal} 積分`, false); return; }
  const data = await apiFetch(`/points/${session.easycard_id}/redeem/${rewardId}`, { method:'POST' });
  if (data.status === 'redeemed') {
    showToast(`🎉 兌換成功！獲得【${name}】`, true);
    await loadAppData();
  } else {
    showToast(data.detail || '兌換失敗', false);
  }
}

// ═══════════════════════════════════════════
// Logout
// ═══════════════════════════════════════════
async function doLogout() {
  await apiFetch('/auth/logout', { method:'POST' });
  localStorage.removeItem('ri_session');
  session = null; appData = {};
  if (mapInst) { mapInst.remove(); mapInst = null; mapMarkers = []; }
  showPage('page-auth');
  switchAuthTab('login');
  showToast('已成功登出', true);
}

// ═══════════════════════════════════════════
// Utils
// ═══════════════════════════════════════════
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function setWidth(id, done, total) { const el = document.getElementById(id); if (el) el.style.width = total > 0 ? Math.round(done/total*100)+'%' : '0%'; }

function showToast(msg, ok = true) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = ok ? '#1b5e20' : '#b71c1c';
  t.style.opacity = '1';
  t.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.style.opacity='0'; t.style.transform='translateX(-50%) translateY(20px)'; }, 3500);
}

function openModal(id) { document.getElementById(id)?.classList.add('on'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('on'); }

// ═══════════════════════════════════════════
// 掃票功能 (Ticket QR Scanner)
// ═══════════════════════════════════════════
let scanStream = null;
let scanAnimFrame = null;
let scannedStationCode = null;
let scannedTicketRaw = null;

function switchScanTab(tab) {
  document.getElementById('scan-tab-camera').classList.toggle('on', tab === 'camera');
  document.getElementById('scan-tab-upload').classList.toggle('on', tab === 'upload');
  document.getElementById('scan-camera-section').style.display = tab === 'camera' ? '' : 'none';
  document.getElementById('scan-upload-section').style.display = tab === 'upload' ? '' : 'none';
  if (tab !== 'camera') stopCameraScan();
  hideScanResult(); hideScanError();
}

function closeScanModal() {
  stopCameraScan();
  hideScanResult(); hideScanError();
  // reset upload
  const fi = document.getElementById('scan-file-input');
  if (fi) fi.value = '';
  // reset manual entry
  const mf = document.getElementById('scan-manual-form');
  if (mf) mf.style.display = 'none';
  const ms = document.getElementById('scan-manual-station');
  if (ms) ms.value = '';
  const mfrom = document.getElementById('scan-manual-from');
  if (mfrom) mfrom.value = '';
  closeModal('scan-modal');
}

async function startCameraScan() {
  hideScanError(); hideScanResult();
  const video = document.getElementById('scan-video');
  const startBtn = document.getElementById('scan-start-btn');
  const stopBtn  = document.getElementById('scan-stop-btn');
  const ocrBtn   = document.getElementById('scan-capture-ocr-btn');
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } }
    });
    video.srcObject = scanStream;
    await video.play();
    startBtn.style.display = 'none';
    stopBtn.style.display  = '';
    if (ocrBtn) ocrBtn.style.display = '';
    setText('scan-status-overlay', '對準車票上的 QR Code…');
    scanFrameLoop();
  } catch (e) {
    showScanError(e.name === 'NotAllowedError' ? '請允許相機存取權限' : '無法開啟相機：' + e.message);
  }
}

function stopCameraScan() {
  if (scanAnimFrame) { cancelAnimationFrame(scanAnimFrame); scanAnimFrame = null; }
  if (scanStream) { scanStream.getTracks().forEach(t => t.stop()); scanStream = null; }
  const video = document.getElementById('scan-video');
  if (video) { video.srcObject = null; }
  const startBtn = document.getElementById('scan-start-btn');
  const stopBtn  = document.getElementById('scan-stop-btn');
  const ocrBtn   = document.getElementById('scan-capture-ocr-btn');
  if (startBtn) startBtn.style.display = '';
  if (stopBtn)  stopBtn.style.display  = 'none';
  if (ocrBtn)   ocrBtn.style.display   = 'none';
}

// 相機模式下手動觸發一次性 OCR（持續每幀辨識文字成本太高，故採按需拍照）
function captureFrameForOCR() {
  const video  = document.getElementById('scan-video');
  const canvas = document.getElementById('scan-canvas');
  if (!video || !canvas) return;

  // 相機畫面尚未就緒（常見於剛點開相機就立刻按下「拍照辨識文字」）
  if (!video.videoWidth || !video.videoHeight) {
    showScanError('相機畫面尚未就緒，請稍等一下再試一次');
    return;
  }

  // 相機畫面解析度通常較拍照上傳低，放大 1.5 倍有助於文字辨識
  const scale = 1.5;
  canvas.width  = video.videoWidth * scale;
  canvas.height = video.videoHeight * scale;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
  stopCameraScan();
  runTicketOCR(dataUrl);
}

function scanFrameLoop() {
  const video  = document.getElementById('scan-video');
  const canvas = document.getElementById('scan-canvas');
  if (!video || !canvas || !scanStream) return;
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
    if (code) {
      processQRData(code.data);
      stopCameraScan();
      return;
    }
  }
  scanAnimFrame = requestAnimationFrame(scanFrameLoop);
}

function handleTicketUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  hideScanError(); hideScanResult();
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.getElementById('scan-upload-canvas');
      canvas.width  = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
      if (code) {
        processQRData(code.data);
      } else {
        // QR 掃不到 → 改用 OCR 辨識票面文字（真實台鐵票 QR 為官方加密格式，本系統無法解析）
        runTicketOCR(e.target.result);
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function runTicketOCR(dataUrl) {
  setText('scan-status-overlay', '');
  showScanError('找不到可辨識的 QR Code，正在改用文字辨識票面車站…');
  const btn = document.getElementById('scan-upload-label');
  try {
    const result = await apiFetch('/ticket/ocr', {
      method: 'POST',
      body: JSON.stringify({ image_base64: dataUrl }),
    });

    if (!result.success) {
      showScanError((result.detail || 'OCR 辨識失敗') + '，請改用下方「手動輸入車站」。');
      openManualEntry();
      return;
    }

    hideScanError();

    const confidenceNote = result.low_confidence
      ? '（部分文字較模糊，已用相近字判斷，請務必確認站名正確）'
      : '';

    if (result.to) {
      // 辨識到出發＋到達站（或僅到達站）
      scannedTicketRaw = null; // OCR 結果非 QR payload，走手動驗票格式
      showScanResult(result.to.code, result.to.name, result.to.icon || '🚉', '台鐵', result.from?.code || null);
      showToast(`已透過文字辨識自動帶入車站，請確認後收集印記${confidenceNote}`, true);
    } else if (result.single) {
      scannedTicketRaw = null;
      showScanResult(result.single.code, result.single.name, result.single.icon || '🚉', '台鐵', null);
      showToast('僅辨識到一個站名，已當作到達站，如方向不對請改用「手動輸入車站」修正', true);
    } else {
      showScanError('文字辨識未能判斷出發/到達站，請改用下方「手動輸入車站」。');
      openManualEntry();
    }
  } catch (err) {
    showScanError('文字辨識發生錯誤，請改用下方「手動輸入車站」。');
    openManualEntry();
  }
}

function processQRData(raw) {
  const s = raw.trim();
  let stationCode = null;
  let fromCode    = null;

  // RI:STATION_CODE[:TS[:CARD]]
  if (s.startsWith('RI:')) {
    const parts = s.split(':');
    stationCode = parts[1]?.toUpperCase();

  // TKT:FROM:TO:YYYYMMDD:SERIAL
  } else if (s.startsWith('TKT:')) {
    const parts = s.split(':');
    fromCode    = parts[1]?.toUpperCase();
    stationCode = parts[2]?.toUpperCase();

  // 純站碼（測試）
  } else if (/^[A-Z]{2,4}$/.test(s)) {
    stationCode = s.toUpperCase();

  // base64 JSON
  } else {
    try {
      const decoded = JSON.parse(atob(s));
      if (decoded.code) {
        stationCode = decoded.code.toUpperCase();
        fromCode    = decoded.from?.toUpperCase() || null;
      }
    } catch (_) {}
  }

  if (!stationCode) {
    showScanError('無法辨識此 QR Code 格式。若這是台鐵紙本車票，其 QR 為官方加密格式，本系統無法解析，請改用下方「手動輸入車站」完成集章。');
    return;
  }

  scannedTicketRaw = s;

  // 先從本地快取找站點，沒有再問 server
  const allStamps = appData.stamps?.stamps || [];
  const station   = allStamps.find(st => st.station_code === stationCode);

  if (station) {
    showScanResult(stationCode, station.station_name, station.icon || '🚉', station.line || '台鐵', fromCode);
    return;
  }

  apiFetch('/stations').then(data => {
    const st = (data.stations || []).find(st => st.code === stationCode);
    if (st) showScanResult(stationCode, st.name, st.icon || '🚉', st.line || '台鐵', fromCode);
    else    showScanError(`找不到站點代碼「${stationCode}」，可能不在收集範圍內`);
  });
}

function showScanResult(code, name, icon, line, fromCode) {
  scannedStationCode = code;
  setText('scan-result-icon', icon);
  setText('scan-result-station', name);

  // 如果有起站顯示「XX → YY」
  const allStamps = appData.stamps?.stamps || [];
  let lineText = line;
  if (fromCode) {
    const fromSt = allStamps.find(s => s.station_code === fromCode);
    const fromName = fromSt?.station_name || fromCode;
    lineText = `${fromName} → ${name}`;
  }
  setText('scan-result-line', lineText);
  document.getElementById('scan-result').style.display = '';
  setText('scan-status-overlay', '✅ 掃描成功！');
}

async function collectFromScan() {
  if (!scannedStationCode) return;
  const btn = document.getElementById('scan-collect-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> 驗票中…';

  // testuser 走模擬進站（保留原本功能）
  if (session?.is_test_user) {
    closeScanModal();
    await quickTap(scannedStationCode);
    return;
  }

  // 一般使用者：送車票原始資料給後端驗票
  const ticketData = scannedTicketRaw || scannedStationCode;
  const result = await apiFetch('/ticket/validate', {
    method: 'POST',
    body: JSON.stringify({ ticket_data: ticketData }),
  });

  if (result.success) {
    closeScanModal();
    const bonus   = result.is_remote_bonus ? '（偏遠加碼）' : '';
    const fromTxt = result.from_station ? `${result.from_icon || ''} ${result.from_station} → ` : '';
    const msg = result.stamp_unlocked
      ? `🏅 新印章！${result.station_icon} ${fromTxt}${result.station} +${result.points_earned} 積分${bonus}`
      : `✅ ${fromTxt}${result.station} · +${result.points_earned} 積分 · ×${result.visit_count} 訪`;
    showToast(msg, true);

    if (result.new_achievements?.length) {
      result.new_achievements.forEach((ach, i) => {
        setTimeout(() => showAchievementPopup(ach), i * 1800);
      });
    }
    if (result.completed_missions?.length) {
      const delay = (result.new_achievements?.length || 0) * 1800;
      result.completed_missions.forEach((m, i) => {
        setTimeout(() => showToast(`🎯 任務完成：${m.icon} ${m.title} +${m.points_reward} 積分`, true), delay + i * 1500);
      });
    }

    await loadAppData();
    if (mapInst) { mapInst.remove(); mapInst = null; mapMarkers = []; }
  } else {
    showScanError(result.detail || '驗票失敗，請稍後再試');
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-stamp"></i> 收集此站印記';
  }
}

function hideScanResult() {
  scannedStationCode = null;
  scannedTicketRaw = null;
  document.getElementById('scan-result').style.display = 'none';
}
function showScanError(msg) {
  setText('scan-error-msg', msg);
  document.getElementById('scan-error').style.display = '';
}
function hideScanError() {
  document.getElementById('scan-error').style.display = 'none';
}

// ── 手動輸入車站（備用方案：QR/OCR 皆無法判斷時）────────
let manualEntryPopulated = false;

function populateManualStationSelects() {
  if (manualEntryPopulated) return;
  const allStamps = appData.stamps?.stamps || [];
  const fill = (selectId, withEmptyDefault) => {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    allStamps
      .slice()
      .sort((a, b) => a.station_name.localeCompare(b.station_name, 'zh-Hant'))
      .forEach(st => {
        const opt = document.createElement('option');
        opt.value = st.station_code;
        opt.textContent = `${st.icon || '🚉'} ${st.station_name}`;
        sel.appendChild(opt);
      });
  };
  fill('scan-manual-station');
  fill('scan-manual-from');
  manualEntryPopulated = true;
}

function toggleManualEntry() {
  const form = document.getElementById('scan-manual-form');
  if (!form) return;
  const showing = form.style.display !== 'none';
  if (showing) { form.style.display = 'none'; return; }
  openManualEntry();
}

function openManualEntry() {
  populateManualStationSelects();
  const form = document.getElementById('scan-manual-form');
  if (form) form.style.display = '';
}

function submitManualEntry() {
  const toSel   = document.getElementById('scan-manual-station');
  const fromSel = document.getElementById('scan-manual-from');
  const toCode  = toSel?.value;
  const fromCode = fromSel?.value || null;

  if (!toCode) {
    showScanError('請選擇到達站');
    return;
  }

  hideScanError();
  scannedTicketRaw = null; // 手動輸入走純站碼格式，由 stationCode 驅動驗票
  const allStamps = appData.stamps?.stamps || [];
  const toSt = allStamps.find(s => s.station_code === toCode);
  showScanResult(toCode, toSt?.station_name || toCode, toSt?.icon || '🚉', '台鐵', fromCode);
}

