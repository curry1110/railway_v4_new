// ═══════════════════════════════════════════
// Config
// ═══════════════════════════════════════════
const API = '/api'; 

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
  const targetScr = document.getElementById('scr-' + scrId);
  const targetNav = document.getElementById('t-' + scrId);
  if (targetScr) targetScr.classList.add('on');
  if (targetNav) targetNav.classList.add('on');
  
  if (scrId === 'map') {
    initLeafletMap();
  } else if (scrId === 'rank') {
    loadLeaderboard();
  } else if (scrId === 'achieve') {
    loadAchievements();
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

  const [me, stamps, stations] = await Promise.all([
    apiFetch('/auth/me'),
    apiFetch(`/stamps/${cardId}`),
    apiFetch('/stations')
  ]);

  appData = { me, stamps, stations: stations.stations || [] };
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
  mapInstance = L.map('map-leaflet').setView([25.0478, 121.5171], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(mapInstance);
  updateMapMarkers();
}

function updateMapMarkers() {
  if (!mapInstance || !appData.stations) return;
  mapMarkers.forEach(m => mapInstance.removeLayer(m));
  mapMarkers = [];
  const stamps = appData.stamps?.stamps || [];
  appData.stations.forEach(s => {
    if (!s.lat || !s.lng) return;
    const isUnlocked = stamps.find(st => st.station_code === s.code)?.is_unlocked;
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

function showSt(code, name, line, rarity, icon) {
  const info = document.getElementById('map-info');
  const stamp = appData.stamps?.stamps?.find(s => s.station_code === code);
  const unlocked = stamp?.is_unlocked;
  const visitCount = stamp?.visit_count || 0;
  
  const rarityLabel = rarity === 'legendary' ? '傳說級' : rarity === 'rare' ? '稀有級' : '普通級';
  const rarityClass = rarity === 'legendary' ? 'tag-legend' : rarity === 'rare' ? 'tag-rare' : 'tag-common';
  
  info.innerHTML = `
    <div class="st-card">
      <div class="st-header">
        <div class="st-icon-big">${icon}</div>
        <div class="st-title-box">
          <div class="st-name">${name}</div>
          <div class="st-line">${line}</div>
        </div>
        <span class="${rarityClass}">${rarityLabel}</span>
      </div>
      <div class="st-stats">
        <div class="st-stat-item">
          <div class="st-stat-lbl">解鎖狀態</div>
          <div class="st-stat-val">${unlocked ? '✅ 已解鎖' : '🔒 尚未造訪'}</div>
        </div>
        <div class="st-stat-item">
          <div class="st-stat-lbl">造訪次數</div>
          <div class="st-stat-val">${visitCount} 次</div>
        </div>
      </div>
      <button class="sim-btn" onclick="doTapDirect('${code}')">模擬進站刷卡</button>
    </div>
  `;
}

async function doTapDirect(stationCode) {
  const res = await apiFetch(`/easycard/simulate-tap?card_id=${session.easycard_id}&station_code=${stationCode}`, { method: 'POST' });
  if (res.station) {
    if (res.stamp_unlocked) {
      showToast(`🎉 獲得新印章：${res.station}！`);
    } else {
      showToast(`再次造訪 ${res.station}！目前造訪 ${res.visit_count} 次`);
    }
    
    if (res.new_achievements && res.new_achievements.length > 0) {
      setTimeout(() => {
        res.new_achievements.forEach(ach => {
          showToast(`🏆 解鎖成就：${ach.name}！(+${ach.points} pts)`);
        });
      }, 1500);
    }
    
    await loadAppData();
    // 更新地圖資訊卡
    const st = appData.stations.find(s => s.code === stationCode);
    if (st) showSt(st.code, st.name, st.line, st.rarity, st.icon);
  } else {
    showToast(res.detail || '刷卡失敗');
  }
}

async function doTap() {
  const code = document.getElementById('tap-station').value;
  closeModal('tap-modal');
  await doTapDirect(code);
}

function renderApp() {
  const me = appData.me || {};
  const stamps = appData.stamps || {};
  
  setText('topbar-username', session?.display_name || '');
  const hour = new Date().getHours();
  const greet = hour < 12 ? '早安' : hour < 18 ? '午安' : '晚安';
  setText('home-greeting', `${greet}，${session?.display_name || '旅人'}！`);

  const bal = me.points || 0;
  setText('ui-points', bal.toLocaleString());
  setText('ui-pts-big', bal.toLocaleString());
  setText('ui-rides', me.total_rides || 0);
  setText('ui-co2', parseFloat(me.total_co2_kg || 0).toFixed(1));

  const allStamps = stamps.stamps || [];
  
  // 去重處理，確保每個站點只顯示一次
  const seenCodes = new Set();
  const uniqueStamps = allStamps.filter(s => {
    if (seenCodes.has(s.station_code)) return false;
    seenCodes.add(s.station_code);
    return true;
  });
  
  const unlocked = uniqueStamps.filter(s => s.is_unlocked);
  const locked = uniqueStamps.filter(s => !s.is_unlocked);
  const trStamps = uniqueStamps.filter(s => s.line === '台鐵縱貫線');
  const trDone = trStamps.filter(s => s.is_unlocked).length;

  setText('ui-stamp-count', unlocked.length);
  setText('stamp-collected', unlocked.length);
  setWidth('prog-tr', trDone, trStamps.length);
  setWidth('stamp-prog', unlocked.length, uniqueStamps.length);
  setText('prog-tr-cnt', `${trDone}/${trStamps.length}`);
  setText('stamp-prog-text', Math.round(unlocked.length / uniqueStamps.length * 100) + '%');
  
  const craftBtn = document.getElementById('craft-btn');
  if (craftBtn) craftBtn.style.display = trDone === trStamps.length ? 'block' : 'none';

  const RARITY = { legendary:'ic-r', rare:'ic-o', common:'ic-b' };
  const RLABEL = { legendary:'傳說', rare:'稀有', common:'普通' };

  function stampCard(s, isLocked) {
    const visitText = s.visit_count && s.visit_count > 1 ? ` x${s.visit_count}` : '';
    return `<div class="stamp${isLocked ? ' locked' : ''}">
      <div class="stamp-icon ${RARITY[s.rarity]||'ic-b'}">${s.icon||'🏷️'}</div>
      <div class="stamp-nm">${s.station_name}</div>
      <div class="stamp-ds">${s.line}</div>
      <span class="badge ${isLocked ? 'bg-k' : 'bg-g'}">${isLocked ? '🔒 '+RLABEL[s.rarity] : '✓ 已收集'+visitText}</span>
    </div>`;
  }
  
  document.getElementById('unlocked-grid').innerHTML = unlocked.length
    ? unlocked.map(s => stampCard(s, false)).join('')
    : '<div style="grid-column:span 2;text-align:center;padding:20px;color:#aaa;font-size:12px">去搭車解鎖第一枚印章吧！</div>';
  document.getElementById('locked-grid').innerHTML = locked.map(s => stampCard(s, true)).join('');

  setText('p-name', me.display_name || '—');
  setText('p-card', me.easycard_id || '—');
  setText('p-card2', me.easycard_id || '—');
  setText('p-username', me.username || '—');
  setText('p-pts', bal.toLocaleString());
  setText('p-stamps', unlocked.length);
  setText('p-rides', me.total_rides || 0);
  setText('p-co2', parseFloat(me.total_co2_kg || 0).toFixed(1));
  setText('p-since', `加入時間：${new Date(me.created_at).toLocaleDateString()}`);
  
  loadHomeAchievementsPreview();
}

async function loadLeaderboard() {
  const data = await apiFetch('/leaderboard');
  const list = document.getElementById('rank-list');
  if (!data.leaderboard) return;
  list.innerHTML = data.leaderboard.map((u, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
    return `<div class="rank-item">
      <div class="rank-medal">${medal}</div>
      <div class="rank-info">
        <div class="rank-name">${u.display_name}</div>
        <div class="rank-sub">${u.stamp_count} 枚印章 · ${u.total_rides} 次搭乘</div>
      </div>
      <div class="rank-pts">${u.total_points.toLocaleString()} pts</div>
    </div>`;
  }).join('');
}

async function loadAchievements() {
  const data = await apiFetch(`/achievements/${appData.me.id}`);
  const grid = document.getElementById('achieve-grid');
  if (!data.achievements) return;
  grid.innerHTML = data.achievements.map(ach => `
    <div class="achieve-card ${ach.is_unlocked ? '' : 'locked'}">
      <div class="achieve-icon">${ach.icon}</div>
      <div class="achieve-name">${ach.name}</div>
      <div class="achieve-desc">${ach.description}</div>
      <div class="achieve-pts">+${ach.points} pts</div>
    </div>
  `).join('');
}

async function loadHomeAchievementsPreview() {
  const data = await apiFetch(`/achievements/${appData.me.id}`);
  const preview = document.getElementById('home-achievements-preview');
  if (!data.achievements) return;
  preview.innerHTML = data.achievements.slice(0, 3).map(ach => `
    <div class="mission-item ${ach.is_unlocked ? '' : 'locked'}" style="${ach.is_unlocked ? '' : 'opacity:0.6'}">
      <div class="mission-icon" style="background:#e6f1fb;color:#0c447c">${ach.icon}</div>
      <div>
        <div style="font-size:13px;font-weight:500">${ach.name}</div>
        <div style="font-size:10px;color:#888">${ach.description}</div>
      </div>
      <div class="mission-pts">${ach.is_unlocked ? '✅ 已達成' : '+' + ach.points}</div>
    </div>
  `).join('');
}

async function doCraft() {
  const res = await apiFetch('/craft/tr-master', { method: 'POST' });
  if (res.success) {
    showToast('🏅 ' + res.message);
    await loadAppData();
  } else {
    showToast(res.detail || '合成失敗');
  }
}

function openQRScanner() {
  openModal('qr-modal');
  setText('qr-status', '正在啟動相機...');
  setTimeout(() => {
    setText('qr-status', '模擬掃描成功！');
    setTimeout(async () => {
      closeModal('qr-modal');
      // 模擬掃描到台北車站
      await doTapDirect('TPE');
    }, 1000);
  }, 2000);
}

function redeem(id, name) {
  showToast(`兌換功能尚未開放：${name}`);
}
