// ═══════════════════════════════════════════
// Config
// ═══════════════════════════════════════════
const API = '/api'; // 改為相對路徑，方便部署

// ═══════════════════════════════════════════
// State
// ═══════════════════════════════════════════
let session = JSON.parse(localStorage.getItem('ri_session') || 'null');
let appData = {};
let mapInstance = null;
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
  } catch (e) {
    return { detail: '無法連線後端' };
  }
}

// ═══════════════════════════════════════════
// 初始化
// ═══════════════════════════════════════════
window.onload = async () => {
  if (session?.token) {
    const check = await apiFetch('/auth/check');
    if (check.valid) {
      await loadAppData();
      showPage('page-app');
      return;
    } else {
      localStorage.removeItem('ri_session');
      session = null;
    }
  }
  showPage('page-auth');
};

// ═══════════════════════════════════════════
// UI Helpers
// ═══════════════════════════════════════════
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('on'));
  document.getElementById(id).classList.add('on');
}

function go(scrId) {
  document.querySelectorAll('.scr').forEach(s => s.classList.remove('on'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('on'));
  document.getElementById('scr-' + scrId).classList.add('on');
  document.getElementById('t-' + scrId).classList.add('on');
  
  if (scrId === 'map') {
    initLeafletMap();
  }
}

function setText(id, txt) { const el = document.getElementById(id); if (el) el.textContent = txt; }
function setWidth(id, val, max) { const el = document.getElementById(id); if (el) el.style.width = (max ? (val / max * 100) : 0) + '%'; }

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.opacity = '1';
  t.style.transform = 'translateX(-50%) translateY(0)';
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(20px)';
  }, 2500);
}

function openModal(id) { document.getElementById(id).classList.add('on'); }
function closeModal(id) { document.getElementById(id).classList.remove('on'); }

// ═══════════════════════════════════════════
// Auth
// ═══════════════════════════════════════════
function switchAuthTab(tab) {
  document.getElementById('tab-login').classList.toggle('on', tab === 'login');
  document.getElementById('tab-register').classList.toggle('on', tab === 'register');
  document.getElementById('form-login').style.display    = tab === 'login' ? 'block' : 'none';
  document.getElementById('form-register').style.display = tab === 'register' ? 'block' : 'none';
  clearErrors();
}

function clearErrors() {
  document.querySelectorAll('.form-error').forEach(e => { e.textContent = ''; e.classList.remove('on'); });
  document.querySelectorAll('.form-input').forEach(e => e.classList.remove('err'));
}

function showErr(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.add('on');
}

function setFieldErr(inputId, errId, msg) {
  const inp = document.getElementById(inputId);
  if (inp) inp.classList.add('err');
  showErr(errId, msg);
}

function fillTest() {
  document.getElementById('login-username').value = 'testuser';
  document.getElementById('login-password').value = '123456';
}

function togglePw(inputId, btn) {
  const inp = document.getElementById(inputId);
  const isText = inp.type === 'text';
  inp.type = isText ? 'password' : 'text';
  btn.className = `toggle-pw ti ti-eye${isText ? '' : '-off'}`;
}

async function doLogin() {
  clearErrors();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  if (!username) { setFieldErr('login-username', 'login-username-err', '請輸入使用者名稱'); return; }
  if (!password)  { setFieldErr('login-password', 'login-pw-err', '請輸入密碼'); return; }

  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> 登入中...';

  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

  btn.disabled = false;
  btn.innerHTML = '<i class="ti ti-login"></i> 登入';

  if (data.token) {
    session = { token: data.token, username: data.username, display_name: data.display_name, easycard_id: data.easycard_id };
    localStorage.setItem('ri_session', JSON.stringify(session));
    await showWelcome(data, false);
  } else {
    showErr('login-global-err', data.detail || '登入失敗，請檢查帳號密碼');
  }
}

async function doRegister() {
  clearErrors();
  const username = document.getElementById('reg-username').value.trim();
  const display  = document.getElementById('reg-display').value.trim();
  const card     = document.getElementById('reg-card').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm  = document.getElementById('reg-confirm').value;

  let ok = true;
  if (!username || username.length < 2) { setFieldErr('reg-username', 'reg-username-err', '至少 2 個字元'); ok = false; }
  if (!display)  { setFieldErr('reg-display', 'reg-display-err', '請輸入顯示名稱'); ok = false; }
  if (!card || card.length < 4) { setFieldErr('reg-card', 'reg-card-err', '請輸入有效悠遊卡號'); ok = false; }
  if (!password || password.length < 6) { setFieldErr('reg-password', 'reg-pw-err', '密碼至少 6 字元'); ok = false; }
  if (password !== confirm) { setFieldErr('reg-confirm', 'reg-confirm-err', '兩次密碼不一致'); ok = false; }
  if (!ok) return;

  const btn = document.getElementById('register-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> 建立中...';

  const data = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, display_name: display, easycard_id: card, password }),
  });

  btn.disabled = false;
  btn.innerHTML = '<i class="ti ti-user-plus"></i> 建立帳號';

  if (data.token) {
    session = { token: data.token, username: data.username, display_name: data.display_name, easycard_id: data.easycard_id };
    localStorage.setItem('ri_session', JSON.stringify(session));
    await showWelcome(data, true);
  } else {
    showErr('reg-global-err', data.detail || '註冊失敗，請稍後再試');
  }
}

async function doLogout() {
  await apiFetch('/auth/logout', { method: 'POST' });
  localStorage.removeItem('ri_session');
  session = null;
  showPage('page-auth');
}

async function showWelcome(authData, isNew) {
  document.getElementById('w-name').textContent = authData.display_name;
  document.getElementById('w-msg').textContent  = isNew ? '帳號建立成功！歡迎加入軌道印記 🎉' : `歡迎回來！${authData.message || ''}`;
  document.getElementById('w-card').textContent = authData.easycard_id;

  const me = await apiFetch('/auth/me');
  document.getElementById('w-pts').textContent    = me.points || 0;
  document.getElementById('w-co2').textContent    = parseFloat(me.total_co2_kg || 0).toFixed(1);

  const stamps = await apiFetch(`/stamps/${authData.easycard_id}`);
  document.getElementById('w-stamps').textContent = stamps?.total_collected || 0;

  showPage('page-welcome');
}

async function goToApp() {
  await loadAppData();
  showPage('page-app');
}

// ═══════════════════════════════════════════
// App Data
// ═══════════════════════════════════════════
async function loadAppData() {
  if (!session) return;
  const cardId = session.easycard_id;

  const [me, stamps, pts, stations] = await Promise.all([
    apiFetch('/auth/me'),
    apiFetch(`/stamps/${cardId}`),
    apiFetch(`/points/${cardId}`),
    apiFetch('/stations')
  ]);

  appData = { me, stamps, pts, stations: stations.stations || [] };
  renderApp();
  updateStationSelect();
}

function updateStationSelect() {
  const sel = document.getElementById('tap-station');
  if (!sel || !appData.stations) return;
  sel.innerHTML = appData.stations.map(s => 
    `<option value="${s.code}">${s.icon} ${s.name}（${s.line}${s.is_remote ? '・偏遠+500' : ''}）</option>`
  ).join('');
}

function initLeafletMap() {
  if (mapInstance) {
    setTimeout(() => mapInstance.invalidateSize(), 100);
    return;
  }

  // 以台北車站為中心
  mapInstance = L.map('map-leaflet').setView([25.0478, 121.5171], 11);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(mapInstance);

  updateMapMarkers();
}

function updateMapMarkers() {
  if (!mapInstance || !appData.stations) return;

  // 清除舊標記
  mapMarkers.forEach(m => mapInstance.removeLayer(m));
  mapMarkers = [];

  const stamps = appData.stamps?.stamps || [];

  appData.stations.forEach(s => {
    if (!s.lat || !s.lng) return;

    const isUnlocked = stamps.find(st => st.station_code === s.code)?.is_unlocked;
    
    // 根據稀有度與解鎖狀態決定圖示顏色
    const color = isUnlocked ? (s.rarity === 'legendary' ? '#e03131' : s.rarity === 'rare' ? '#f08c00' : '#0d2b6e') : '#adb5bd';
    
    const icon = L.divIcon({
      className: 'custom-div-icon',
      html: `<div style="background-color:${color}; width:24px; height:24px; border-radius:50%; border:2px solid white; display:flex; align-items:center; justify-content:center; color:white; font-size:12px; box-shadow:0 2px 5px rgba(0,0,0,0.2)">${s.icon}</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    const marker = L.marker([s.lat, s.lng], { icon }).addTo(mapInstance);
    marker.on('click', () => showSt(s.code, s.name, s.line, s.rarity, s.icon));
    mapMarkers.push(marker);
  });
}

function updateMapStations() {
  // 原有的按鈕更新邏輯，如果地圖載入後則更新標記
  if (mapInstance) updateMapMarkers();
}

function renderApp() {
  const me     = appData.me    || {};
  const stamps = appData.stamps|| {};
  const pts    = appData.pts   || {};

  setText('topbar-username', session?.display_name || '');

  const hour = new Date().getHours();
  const greet = hour < 12 ? '早安' : hour < 18 ? '午安' : '晚安';
  setText('home-greeting', `${greet}，${session?.display_name || '旅人'}！`);

  const bal = pts.balance || me.points || 0;
  setText('ui-points',     bal.toLocaleString());
  setText('ui-pts-big',    bal.toLocaleString());
  setText('ui-rides',      me.monthly_trips || 0);
  setText('ui-carbon',     parseFloat(me.total_co2_kg || pts.total_co2_kg || 0).toFixed(1));
  setText('ui-co2',        parseFloat(me.total_co2_kg || pts.total_co2_kg || 0).toFixed(1));
  setText('ui-km',         parseFloat(pts.total_km || 0).toFixed(0));

  const allStamps  = stamps.stamps || [];
  const unlocked   = allStamps.filter(s => s.is_unlocked);
  const locked     = allStamps.filter(s => !s.is_unlocked);
  const total      = allStamps.length;
  const trStamps   = allStamps.filter(s => s.line === '台鐵縱貫線');
  const mrtStamps  = allStamps.filter(s => s.line !== '台鐵縱貫線');
  const trDone     = trStamps.filter(s => s.is_unlocked).length;
  const mrtDone    = mrtStamps.filter(s => s.is_unlocked).length;

  setText('ui-stamp-count',  unlocked.length);
  setText('stamp-collected', unlocked.length);
  setWidth('prog-tr',  trDone,  trStamps.length);
  setWidth('prog-mrt', mrtDone, mrtStamps.length);
  setWidth('stamp-prog', unlocked.length, total);
  setText('prog-tr-cnt',  `${trDone}/${trStamps.length}`);
  setText('prog-mrt-cnt', `${mrtDone}/${mrtStamps.length}`);
  setText('prog-tr-hint',  trDone < trStamps.length ? `再集 ${trStamps.length-trDone} 枚可合成「縱貫鐵道大章」` : '🎉 全線完成！');
  setText('prog-mrt-hint', mrtDone < mrtStamps.length ? `沿線待探索` : '🎉 全線完成！');

  const RARITY = { legendary:'ic-r', rare:'ic-o', common:'ic-b' };
  const RLABEL = { legendary:'傳說', rare:'稀有', common:'普通' };

  function stampCard(s, locked) {
    const visitText = s.visit_count && s.visit_count > 1 ? ` x${s.visit_count}` : '';
    return `<div class="stamp${locked ? ' locked' : ''}">
      <div class="stamp-icon ${RARITY[s.rarity]||'ic-b'}">${s.icon||'🏷️'}</div>
      <div class="stamp-nm">${s.station_name}</div>
      <div class="stamp-ds">${s.line}</div>
      <span class="badge ${locked ? 'bg-k' : 'bg-g'}">${locked ? '🔒 '+RLABEL[s.rarity] : '✓ 已收集'+visitText}</span>
    </div>`;
  }
  document.getElementById('unlocked-grid').innerHTML = unlocked.length
    ? unlocked.map(s => stampCard(s, false)).join('')
    : '<div style="grid-column:span 2;text-align:center;padding:20px;color:#aaa;font-size:12px">去搭車解鎖第一枚印章吧！</div>';
  document.getElementById('locked-grid').innerHTML = locked.map(s => stampCard(s, true)).join('');

  setText('p-name',     session?.display_name || '—');
  setText('p-card',     session?.easycard_id  || '—');
  setText('p-card2',    session?.easycard_id  || '—');
  setText('p-username', session?.username     || '—');
  setText('p-pts',      bal.toLocaleString());
  setText('p-stamps',   unlocked.length);
  setText('p-rides',    me.monthly_trips || 0);
  setText('p-co2',      parseFloat(me.total_co2_kg || 0).toFixed(1));

  const av = document.getElementById('p-avatar');
  if (av && session?.display_name) av.textContent = session.display_name[0];
  setText('p-since', `加入時間：${me.created_at ? me.created_at.slice(0,10) : '今日'}`);

  // 控制模擬進站按鈕顯示 (僅測試帳號)
  const simBtns = document.querySelectorAll('.sim-btn-container');
  simBtns.forEach(b => {
    b.style.display = (session?.username === 'testuser') ? 'block' : 'none';
  });

  // 更新地圖站點按鈕
  updateMapStations();
}

// ═══════════════════════════════════════════
// 地圖與刷卡
// ═══════════════════════════════════════════
function showSt(code, name, line, rarity, icon) {
  const stamps   = (appData.stamps?.stamps || []);
  const myStamp  = stamps.find(s => s.station_code === code);
  const owned    = myStamp?.is_unlocked || false;
  const visitCount = myStamp?.visit_count || 0;
  const rarityL  = {legendary:'傳說限定', rare:'稀有', common:'普通'}[rarity] || rarity;
  const tagCls   = rarity === 'legendary' ? 'tag-legend' : rarity === 'rare' ? 'tag-rare' : 'tag-common';

  let simHtml = '';
  if (session?.username === 'testuser') {
    simHtml = `<button class="sim-btn" onclick="doTapDirect('${code}')"><i class="ti ti-train"></i> 模擬進站</button>`;
  }

  const info = document.getElementById('map-info');
  info.innerHTML = `
    <div class="st-card">
      <div class="st-header">
        <div class="st-icon-big">${icon}</div>
        <div class="st-title-box">
          <div class="st-name">${name} <span class="${tagCls}">${rarityL}</span></div>
          <div class="st-line">${line}</div>
        </div>
        ${simHtml}
      </div>
      <div class="st-stats">
        <div class="st-stat-item">
          <div class="st-stat-lbl">收集狀態</div>
          <div class="st-stat-val" style="color:${owned ? '#2f9e44' : '#868e96'}">${owned ? '✓ 已收集' : '○ 尚未收集'}</div>
        </div>
        <div class="st-stat-item">
          <div class="st-stat-lbl">造訪次數</div>
          <div class="st-stat-val">${visitCount} 次</div>
        </div>
      </div>
    </div>
  `;
}

async function doTapDirect(code) {
  const data = await apiFetch(`/easycard/simulate-tap?card_id=${session.easycard_id}&station_code=${code}`, { method: 'POST' });
  if (data.station) {
    const msg = data.stamp_unlocked 
      ? `🎉 獲得新印章：${data.station}！` 
      : `再次造訪 ${data.station}！目前造訪 ${data.visit_count} 次`;
    showToast(msg);
    await loadAppData();
    // 更新當前顯示的資訊卡
    const st = appData.stations.find(s=>s.code===code);
    showSt(code, data.station, st.line, st.rarity, data.stamp_icon);
  } else {
    showToast(data.detail || '刷卡失敗');
  }
}

async function doTap() {
  const code = document.getElementById('tap-station').value;
  closeModal('tap-modal');
  await doTapDirect(code);
}

// ═══════════════════════════════════════════
// 乘車碼掃描
// ═══════════════════════════════════════════
function openQRScanner() {
  openModal('qr-modal');
  // 模擬掃描過程
  setTimeout(() => {
    const stations = appData.stations || [];
    if (stations.length > 0) {
      const randomStation = stations[Math.floor(Math.random() * stations.length)];
      document.getElementById('qr-status').textContent = `已辨識：${randomStation.name}`;
      setTimeout(() => {
        closeModal('qr-modal');
        doTapDirect(randomStation.code);
      }, 1000);
    }
  }, 2000);
}

// ═══════════════════════════════════════════
// 積分兌換
// ═══════════════════════════════════════════
async function redeem(rid, name) {
  if (!confirm(`確定要花費積分兌換「${name}」嗎？`)) return;
  const res = await apiFetch(`/points/${session.easycard_id}/redeem/${rid}`, { method:'POST' });
  if (res.status === 'redeemed') {
    showToast(`🎉 兌換成功！餘額：${res.remaining_points}`);
    await loadAppData();
  } else {
    showToast(res.detail || '兌換失敗');
  }
}
