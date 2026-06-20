const express = require('express');
const mysql   = require('mysql2/promise');
const cors    = require('cors');
const path    = require('path');
const crypto  = require('crypto');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// ── DB Pool ────────────────────────────────
const pool = mysql.createPool({
  host: 'localhost', user: 'root', password: '1234',
  database: 'railway_imprint',
  waitForConnections: true, connectionLimit: 10, queueLimit: 0
});

// ── Auth ───────────────────────────────────
const sessions = new Map();
const TEST_USERNAME = 'testuser';

function hashPw(pw)       { return crypto.createHash('sha256').update(pw + 'ri_salt_2024').digest('hex'); }
function genToken()       { return crypto.randomBytes(32).toString('hex'); }
function getSession(req)  {
  const t = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
  return t ? sessions.get(t) : null;
}
function isTestUser(req)  { const s = getSession(req); return s && s.username === TEST_USERNAME; }

// ── Stations ───────────────────────────────
const STATIONS_LIST = [
  {id:1,  code:'KEL', name:'基隆',   line:'台鐵縱貫線', rarity:'legendary', base_points:100, is_remote:false, dist_km:0,    icon:'⚓',  lat:25.1315, lng:121.7400},
  {id:2,  code:'SKU', name:'三坑',   line:'台鐵縱貫線', rarity:'common',    base_points:50,  is_remote:false, dist_km:1.3,  icon:'🚉',  lat:25.1230, lng:121.7310},
  {id:3,  code:'BAD', name:'八堵',   line:'台鐵縱貫線', rarity:'common',    base_points:50,  is_remote:false, dist_km:3.7,  icon:'🚉',  lat:25.1082, lng:121.7289},
  {id:4,  code:'QDU', name:'七堵',   line:'台鐵縱貫線', rarity:'rare',      base_points:80,  is_remote:true,  dist_km:6.0,  icon:'🚂',  lat:25.0975, lng:121.7142},
  {id:5,  code:'BIF', name:'百福',   line:'台鐵縱貫線', rarity:'common',    base_points:50,  is_remote:false, dist_km:8.7,  icon:'🚉',  lat:25.0778, lng:121.6936},
  {id:6,  code:'WUD', name:'五堵',   line:'台鐵縱貫線', rarity:'common',    base_points:50,  is_remote:false, dist_km:11.7, icon:'🚉',  lat:25.0711, lng:121.6706},
  {id:7,  code:'XZH', name:'汐止',   line:'台鐵縱貫線', rarity:'common',    base_points:50,  is_remote:false, dist_km:13.1, icon:'🌊',  lat:25.0685, lng:121.6611},
  {id:8,  code:'XKE', name:'汐科',   line:'台鐵縱貫線', rarity:'common',    base_points:50,  is_remote:false, dist_km:14.6, icon:'🚉',  lat:25.0638, lng:121.6468},
  {id:9,  code:'NNG', name:'南港',   line:'台鐵縱貫線', rarity:'common',    base_points:50,  is_remote:false, dist_km:19.1, icon:'💡',  lat:25.0521, lng:121.6068},
  {id:10, code:'SHS', name:'松山',   line:'台鐵縱貫線', rarity:'common',    base_points:50,  is_remote:false, dist_km:21.9, icon:'🏭',  lat:25.0491, lng:121.5784},
  {id:11, code:'TPE', name:'台北',   line:'台鐵縱貫線', rarity:'legendary', base_points:80,  is_remote:false, dist_km:28.3, icon:'🏛️', lat:25.0478, lng:121.5171},
  {id:12, code:'WNH', name:'萬華',   line:'台鐵縱貫線', rarity:'common',    base_points:60,  is_remote:false, dist_km:31.1, icon:'⛩️', lat:25.0335, lng:121.5000},
  {id:13, code:'BQO', name:'板橋',   line:'台鐵縱貫線', rarity:'common',    base_points:50,  is_remote:false, dist_km:35.5, icon:'🏡',  lat:25.0130, lng:121.4637},
  {id:14, code:'FUZ', name:'浮洲',   line:'台鐵縱貫線', rarity:'common',    base_points:50,  is_remote:false, dist_km:38.0, icon:'🚉',  lat:25.0031, lng:121.4444},
  {id:15, code:'SLN', name:'樹林',   line:'台鐵縱貫線', rarity:'common',    base_points:50,  is_remote:false, dist_km:40.9, icon:'🌲',  lat:24.9918, lng:121.4244},
  {id:16, code:'NSL', name:'南樹林', line:'台鐵縱貫線', rarity:'common',    base_points:50,  is_remote:false, dist_km:42.9, icon:'🚉',  lat:24.9818, lng:121.4144},
  {id:17, code:'SJA', name:'山佳',   line:'台鐵縱貫線', rarity:'common',    base_points:50,  is_remote:false, dist_km:44.8, icon:'⛰️', lat:24.9721, lng:121.3900},
  {id:18, code:'YGE', name:'鶯歌',   line:'台鐵縱貫線', rarity:'rare',      base_points:70,  is_remote:false, dist_km:49.2, icon:'🏺',  lat:24.9547, lng:121.3556},
  {id:19, code:'TAO', name:'桃園',   line:'台鐵縱貫線', rarity:'legendary', base_points:80,  is_remote:false, dist_km:57.4, icon:'🍑',  lat:24.9894, lng:121.3136},
  {id:20, code:'NLI', name:'內壢',   line:'台鐵縱貫線', rarity:'common',    base_points:50,  is_remote:false, dist_km:63.3, icon:'🚉',  lat:24.9725, lng:121.2581},
  {id:21, code:'ZLI', name:'中壢',   line:'台鐵縱貫線', rarity:'legendary', base_points:80,  is_remote:false, dist_km:67.3, icon:'🏙️', lat:24.9536, lng:121.2250},
  {id:22, code:'PSN', name:'埔心',   line:'台鐵縱貫線', rarity:'common',    base_points:50,  is_remote:false, dist_km:73.1, icon:'🚉',  lat:24.9192, lng:121.1825},
  {id:23, code:'YME', name:'楊梅',   line:'台鐵縱貫線', rarity:'common',    base_points:50,  is_remote:false, dist_km:77.1, icon:'🌳',  lat:24.9136, lng:121.1444},
  {id:24, code:'FGA', name:'富岡',   line:'台鐵縱貫線', rarity:'rare',      base_points:70,  is_remote:true,  dist_km:82.1, icon:'🌾',  lat:24.9353, lng:121.0833},
  {id:25, code:'XFU', name:'新富',   line:'台鐵縱貫線', rarity:'rare',      base_points:70,  is_remote:true,  dist_km:83.7, icon:'🆕',  lat:24.9311, lng:121.0667},
];
const STATION_BY_CODE = {};
STATIONS_LIST.forEach(s => { STATION_BY_CODE[s.code] = s; });
const CO2_PER_KM = 0.021;

const REWARDS = [
  {id:'R001', name:'超商咖啡兌換券', desc:'中杯美式',         cost:200,  icon:'☕'},
  {id:'R002', name:'公車/捷運折抵',  desc:'單程折 5 元',       cost:100,  icon:'🚌'},
  {id:'R003', name:'ESG 綠色護照',   desc:'企業贊助回饋憑證',  cost:500,  icon:'🌿'},
  {id:'R004', name:'北北基桃稀有合成徽章', desc:'集滿傳說章合成',cost:2000, icon:'🏅'},
];

// ── 成就定義（同步 schema）────────────────
const ACHIEVEMENTS_DEF = [
  {code:'FIRST_RIDE',         name:'初試啼聲',     desc:'完成第一次搭乘',            points:100,  icon:'🚀', condition: u => u.total_rides >= 1},
  {code:'TEN_RIDES',          name:'鐵道常客',     desc:'累計搭乘 10 次',            points:500,  icon:'🎫', condition: u => u.total_rides >= 10},
  {code:'THIRTY_RIDES',       name:'鐵道狂人',     desc:'累計搭乘 30 次',            points:1500, icon:'🚂', condition: u => u.total_rides >= 30},
  {code:'STAMP_5',            name:'印章新手',     desc:'收集 5 枚站點印章',         points:300,  icon:'🎨', condition: (u,st) => st >= 5},
  {code:'STAMP_10',           name:'印章達人',     desc:'收集 10 枚站點印章',        points:800,  icon:'🖼️', condition: (u,st) => st >= 10},
  {code:'STAMP_ALL',          name:'全線制霸',     desc:'收集所有 25 枚印章',        points:5000, icon:'👑', condition: (u,st) => st >= 25},
  {code:'CARBON_10',          name:'減碳先鋒',     desc:'累計減碳 10 kg',            points:1000, icon:'🌿', condition: u => parseFloat(u.total_carbon_saved) >= 10},
  {code:'CARBON_50',          name:'環保英雄',     desc:'累計減碳 50 kg',            points:3000, icon:'🌍', condition: u => parseFloat(u.total_carbon_saved) >= 50},
  {code:'LEGEND_1',           name:'傳說獵人',     desc:'收集到第一枚傳說印章',      points:2000, icon:'🏆', condition: (u,st,lg) => lg >= 1},
  {code:'LEGEND_ALL',         name:'傳說集結',     desc:'收集全部 4 枚傳說印章',     points:8000, icon:'💎', condition: (u,st,lg) => lg >= 4},
  {code:'REMOTE_EXPLORER',    name:'偏鄉探索家',   desc:'探訪偏遠站（七堵/富岡/新富）',points:600, icon:'🗺️', condition: (u,st,lg,rm) => rm >= 1},
  {code:'KEELUNG_TAIPEI',     name:'基北一日遊',   desc:'同日搭乘基隆→台北',         points:400,  icon:'🌉', condition: (u,st,lg,rm,kl) => kl},
  {code:'TAOYUAN_EXPLORER',   name:'桃園踏查',     desc:'抵達桃園或中壢',            points:600,  icon:'🍑', condition: (u,st,lg,rm,kl,to) => to},
];

// ── 工具 ───────────────────────────────────
async function getOrCreateUser(conn, easycard_id) {
  const [rows] = await conn.query('SELECT * FROM users WHERE easycard_id = ?', [easycard_id]);
  if (rows.length > 0) return rows[0];
  const [r] = await conn.query(
    'INSERT INTO users (easycard_id, name) VALUES (?,?)',
    [easycard_id, `旅人_${easycard_id.slice(-4)}`]
  );
  return { id: r.insertId, easycard_id, name: `旅人_${easycard_id.slice(-4)}`, total_points:0, total_rides:0, total_carbon_saved:0, total_km:0 };
}

async function checkAndGrantAchievements(conn, userId) {
  const [userRows]    = await conn.query('SELECT * FROM users WHERE id=?', [userId]);
  const user          = userRows[0];
  const [stRows]      = await conn.query('SELECT COUNT(*) as cnt FROM user_stamps WHERE user_id=?', [userId]);
  const [lgRows]      = await conn.query(
    `SELECT COUNT(*) as cnt FROM user_stamps us
     JOIN stations st ON us.station_id=st.id
     WHERE us.user_id=? AND st.rarity='legendary'`, [userId]
  );
  const [rmRows]      = await conn.query(
    `SELECT COUNT(*) as cnt FROM user_stamps us
     JOIN stations st ON us.station_id=st.id
     WHERE us.user_id=? AND st.is_remote=1`, [userId]
  );
  // 基隆+台北同日
  const [klRows]      = await conn.query(
    `SELECT COUNT(DISTINCT DATE(j.traveled_at)) as cnt FROM journeys j
     JOIN stations st ON j.end_station_id=st.id
     WHERE j.user_id=? AND st.code IN ('KEL','TPE')
     GROUP BY DATE(j.traveled_at) HAVING COUNT(DISTINCT st.code)>=2`, [userId]
  );
  // 桃園/中壢
  const [toRows]      = await conn.query(
    `SELECT COUNT(*) as cnt FROM user_stamps us
     JOIN stations st ON us.station_id=st.id
     WHERE us.user_id=? AND st.code IN ('TAO','ZLI')`, [userId]
  );
  const [unlockedRows]= await conn.query('SELECT achievement_id FROM user_achievements WHERE user_id=?', [userId]);
  const unlockedIds   = new Set(unlockedRows.map(r => r.achievement_id));
  const [allAchs]     = await conn.query('SELECT * FROM achievements');

  const stCnt = stRows[0].cnt;
  const lgCnt = lgRows[0].cnt;
  const rmCnt = rmRows[0].cnt;
  const klMet = klRows.length > 0;
  const toMet = toRows[0].cnt > 0;

  const newlyGranted = [];
  for (const def of ACHIEVEMENTS_DEF) {
    const ach = allAchs.find(a => a.code === def.code);
    if (!ach || unlockedIds.has(ach.id)) continue;
    const met = def.condition(user, stCnt, lgCnt, rmCnt, klMet, toMet);
    if (met) {
      await conn.query('INSERT IGNORE INTO user_achievements (user_id,achievement_id) VALUES (?,?)', [userId, ach.id]);
      await conn.query('UPDATE users SET total_points=total_points+? WHERE id=?', [ach.points, userId]);
      newlyGranted.push({ id:ach.id, name:ach.name, icon:ach.icon, points:ach.points, desc:ach.description });
    }
  }
  return newlyGranted;
}

// ════════════════════════════════════════════
// AUTH ROUTES
// ════════════════════════════════════════════
app.post('/api/auth/register', async (req, res) => {
  const { username, display_name, easycard_id, password } = req.body;
  if (!username || !display_name || !easycard_id || !password)
    return res.status(400).json({ detail: '缺少必要欄位' });
  if (password.length < 6)
    return res.status(400).json({ detail: '密碼至少 6 字元' });

  const conn = await pool.getConnection();
  try {
    const [ex] = await conn.query('SELECT id FROM users WHERE username=? OR easycard_id=?', [username, easycard_id]);
    if (ex.length > 0) { conn.release(); return res.status(409).json({ detail: '帳號或悠遊卡號已被使用' }); }
    const [r] = await conn.query(
      'INSERT INTO users (username,name,display_name,easycard_id,pw_hash) VALUES (?,?,?,?,?)',
      [username, display_name, display_name, easycard_id, hashPw(password)]
    );
    conn.release();
    const token = genToken();
    sessions.set(token, { user_id:r.insertId, easycard_id, username, display_name });
    res.json({ token, username, display_name, easycard_id, message:'帳號建立成功！歡迎加入軌道印記' });
  } catch (err) { conn.release(); res.status(500).json({ detail: err.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ detail:'請輸入帳號密碼' });
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE username=?', [username]);
    if (!rows.length) return res.status(401).json({ detail:'帳號或密碼錯誤' });
    const user = rows[0];
    if (user.pw_hash && user.pw_hash !== hashPw(password))
      return res.status(401).json({ detail:'帳號或密碼錯誤' });
    const token = genToken();
    const display = user.display_name || user.name;
    sessions.set(token, { user_id:user.id, easycard_id:user.easycard_id, username:user.username, display_name:display });
    res.json({ token, username:user.username, display_name:display, easycard_id:user.easycard_id, message:'歡迎回來！' });
  } catch (err) { res.status(500).json({ detail:err.message }); }
});

app.get('/api/auth/check', (req, res) => {
  const sess = getSession(req);
  if (!sess) return res.json({ valid:false });
  // 回傳是否為測試帳號，前端依此顯示模擬進站按鈕
  res.json({ valid:true, is_test_user: sess.username === TEST_USERNAME });
});

app.post('/api/auth/logout', (req, res) => {
  const t = (req.headers['authorization']||'').replace(/^Bearer\s+/i,'').trim();
  sessions.delete(t);
  res.json({ message:'已登出' });
});

app.get('/api/auth/me', async (req, res) => {
  const sess = getSession(req);
  if (!sess) return res.status(401).json({ detail:'未登入' });
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id=?', [sess.user_id]);
    if (!rows.length) return res.status(404).json({ detail:'找不到使用者' });
    const u = rows[0];
    const [mo] = await pool.query(
      'SELECT COUNT(*) as cnt FROM journeys WHERE user_id=? AND MONTH(traveled_at)=MONTH(NOW()) AND YEAR(traveled_at)=YEAR(NOW())',
      [u.id]
    );
    res.json({
      id: u.id,
      username: u.username,
      display_name: u.display_name || u.name,
      easycard_id: u.easycard_id,
      points: u.total_points,
      total_rides: u.total_rides,
      monthly_trips: mo[0].cnt,
      total_co2_kg: parseFloat(u.total_carbon_saved||0),
      total_km: parseFloat(u.total_km||0),
      created_at: u.created_at,
      is_test_user: u.username === TEST_USERNAME,
    });
  } catch (err) { res.status(500).json({ detail:err.message }); }
});

// ════════════════════════════════════════════
// STAMPS
// ════════════════════════════════════════════
app.get('/api/stamps/:easycard_id', async (req, res) => {
  const { easycard_id } = req.params;
  try {
    const [userRows] = await pool.query('SELECT id FROM users WHERE easycard_id=?', [easycard_id]);
    const userId = userRows[0]?.id ?? -1;
    const [owned] = await pool.query('SELECT station_id,visit_count,unlocked_at FROM user_stamps WHERE user_id=?', [userId]);
    const ownedMap = {};
    owned.forEach(r => { ownedMap[r.station_id] = r; });
    const stamps = STATIONS_LIST.map(st => ({
      station_code:st.code, station_name:st.name, line:st.line, rarity:st.rarity,
      icon:st.icon, is_remote:st.is_remote,
      is_unlocked: st.id in ownedMap,
      visit_count: ownedMap[st.id]?.visit_count || 0,
      unlocked_at: ownedMap[st.id]?.unlocked_at || null,
    }));
    res.json({ stamps, total_collected: Object.keys(ownedMap).length, total: STATIONS_LIST.length });
  } catch (err) { res.status(500).json({ detail:err.message }); }
});

// ════════════════════════════════════════════
// SIMULATE TAP — 只允許 testuser
// ════════════════════════════════════════════
app.post('/api/easycard/simulate-tap', async (req, res) => {
  // 驗證只有 testuser 可以使用
  if (!isTestUser(req)) {
    return res.status(403).json({
      detail: '模擬進站僅限測試帳號（testuser）使用。實際上線後將由悠遊卡 Webhook 觸發。'
    });
  }

  const { card_id, station_code } = req.query;
  const dest = STATION_BY_CODE[station_code];
  if (!dest) return res.status(404).json({ detail:`找不到站點 ${station_code}` });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const user = await getOrCreateUser(conn, card_id);
    const pts  = dest.base_points + (dest.is_remote ? 500 : 0);
    const co2  = parseFloat((dest.dist_km * CO2_PER_KM).toFixed(3));

    await conn.query(
      'INSERT INTO journeys (user_id,end_station_id,distance_km,carbon_saved,points_earned) VALUES (?,?,?,?,?)',
      [user.id, dest.id, dest.dist_km, co2, pts]
    );
    const [result] = await conn.query(
      'INSERT INTO user_stamps (user_id,station_id,visit_count,unlocked_at,last_visited_at) VALUES (?,?,1,NOW(),NOW()) ON DUPLICATE KEY UPDATE visit_count=visit_count+1,last_visited_at=NOW()',
      [user.id, dest.id]
    );
    const stampUnlocked = result.affectedRows === 1;

    await conn.query(
      'UPDATE users SET total_points=total_points+?,total_rides=total_rides+1,total_carbon_saved=total_carbon_saved+?,total_km=total_km+? WHERE id=?',
      [pts, co2, dest.dist_km, user.id]
    );

    // 成就檢查
    const newAchs = await checkAndGrantAchievements(conn, user.id);

    // 任務完成檢查
    const completedMissions = await checkMissions(conn, user.id, dest.id);

    await conn.commit();
    const [vc] = await conn.query('SELECT visit_count FROM user_stamps WHERE user_id=? AND station_id=?', [user.id, dest.id]);
    conn.release();

    res.json({
      station: dest.name, points_earned: pts, co2_saved_kg: co2,
      distance_km: dest.dist_km, stamp_unlocked: stampUnlocked,
      stamp_icon: dest.icon, is_remote_bonus: dest.is_remote,
      visit_count: vc[0]?.visit_count || 1,
      new_achievements: newAchs,
      completed_missions: completedMissions,
    });
  } catch (err) {
    await conn.rollback(); conn.release();
    res.status(500).json({ detail:err.message });
  }
});

// 乘車碼掃描入站（一般使用者也可掃描，但不觸發實際積分——展示用）
app.post('/api/easycard/qr-scan', async (req, res) => {
  const sess = getSession(req);
  if (!sess) return res.status(401).json({ detail:'未登入' });
  const { station_code } = req.body;
  const dest = STATION_BY_CODE[station_code];
  if (!dest) return res.status(404).json({ detail:`找不到站點 ${station_code}` });

  if (sess.username === TEST_USERNAME) {
    // testuser 掃碼等同模擬進站
    return res.json({
      mode: 'simulate',
      station: dest.name, icon: dest.icon,
      message: `測試帳號：模擬進站 ${dest.name}，請確認後觸發積分`,
      redirect_to_simulate: true,
      station_code: dest.code,
    });
  }
  // 一般使用者：顯示乘車碼資訊，正式版等悠遊卡 Webhook
  res.json({
    mode: 'info',
    station: dest.name, icon: dest.icon, line: dest.line,
    message: `顯示 ${dest.name} 站乘車 QR 碼。正式版將由悠遊卡系統即時驗證並計分。`,
  });
});

// ════════════════════════════════════════════
// TICKET VALIDATE
// ════════════════════════════════════════════

// 支援格式：
//   RI:STATION_CODE[:TIMESTAMP[:CARD_ID]]        → 本站自製 QR（站內貼紙）
//   TKT:FROM_CODE:TO_CODE:YYYYMMDD:SERIAL        → 模擬台鐵紙本車票
//   STATION_CODE                                  → 純站碼（測試用）
//   base64(JSON{code,from?,ts?})                  → 舊版 JSON 格式
function parseTicket(raw) {
  const s = raw.trim();

  // Format A: RI:STATION_CODE[:TS[:CARD]]
  if (s.startsWith('RI:')) {
    const parts = s.split(':');
    const stationCode = parts[1]?.toUpperCase();
    const ts          = parts[2] ? parseInt(parts[2]) : null;
    const cardId      = parts[3] || null;
    if (!stationCode) return { valid: false, error: '車票站碼缺失' };
    // 允許同一天同站重複掃（以日期為 key），避免逐秒不同
    const dayKey = ts ? new Date(ts).toISOString().slice(0, 10) : 'nodate';
    return {
      valid: true, type: 'RI',
      stationCode, fromCode: null, ts, cardId,
      ticketKey: `RI:${stationCode}:${dayKey}`,
      expiresMs: 24 * 3600 * 1000,  // 24h
    };
  }

  // Format B: TKT:FROM:TO:YYYYMMDD:SERIAL
  if (s.startsWith('TKT:')) {
    const parts = s.split(':');
    if (parts.length < 5) return { valid: false, error: '車票格式錯誤（TKT 格式需包含 5 個欄位）' };
    const fromCode    = parts[1]?.toUpperCase();
    const stationCode = parts[2]?.toUpperCase();
    const dateStr     = parts[3];   // YYYYMMDD
    const serial      = parts[4];
    if (!stationCode || !serial) return { valid: false, error: '車票格式不完整' };
    return {
      valid: true, type: 'TKT',
      stationCode, fromCode, dateStr, serial,
      ticketKey: `TKT:${serial}`,
      expiresMs: null,
    };
  }

  // Format C: plain station code (2-4 uppercase letters)
  if (/^[A-Z]{2,4}$/.test(s)) {
    return {
      valid: true, type: 'PLAIN',
      stationCode: s, fromCode: null, ts: null,
      ticketKey: null,  // plain code 不做重複限制（測試用）
      expiresMs: null,
    };
  }

  // Format D: base64 JSON
  try {
    const decoded = JSON.parse(Buffer.from(s, 'base64').toString('utf8'));
    if (decoded.code) {
      const stationCode = decoded.code.toUpperCase();
      const ts          = decoded.ts || null;
      const dayKey      = ts ? new Date(ts).toISOString().slice(0, 10) : 'nodate';
      return {
        valid: true, type: 'JSON',
        stationCode, fromCode: decoded.from?.toUpperCase() || null, ts,
        ticketKey: `JSON:${stationCode}:${dayKey}`,
        expiresMs: ts ? 24 * 3600 * 1000 : null,
      };
    }
  } catch (_) {}

  return { valid: false, error: '無法辨識車票格式，請確認是否為台鐵車票 QR Code' };
}

app.post('/api/ticket/validate', async (req, res) => {
  const sess = getSession(req);
  if (!sess) return res.status(401).json({ detail: '請先登入' });

  const { ticket_data } = req.body;
  if (!ticket_data) return res.status(400).json({ detail: '缺少車票資料' });

  const parsed = parseTicket(ticket_data);
  if (!parsed.valid) return res.status(400).json({ detail: parsed.error });

  const dest = STATION_BY_CODE[parsed.stationCode];
  if (!dest) return res.status(404).json({ detail: `找不到站點「${parsed.stationCode}」，此站不在收集範圍內` });

  const fromSt = parsed.fromCode ? STATION_BY_CODE[parsed.fromCode] : null;

  // 時間效期驗證（RI / JSON 格式才有 ts）
  if (parsed.ts && parsed.expiresMs) {
    if (Date.now() - parsed.ts > parsed.expiresMs) {
      return res.status(400).json({ detail: '此車票已過期（超過 24 小時）' });
    }
  }

  // TKT 格式：驗證日期需為今日 ± 1 天
  if (parsed.type === 'TKT' && parsed.dateStr) {
    const yr = parseInt(parsed.dateStr.slice(0, 4));
    const mo = parseInt(parsed.dateStr.slice(4, 6)) - 1;
    const dy = parseInt(parsed.dateStr.slice(6, 8));
    const ticketDate = new Date(yr, mo, dy);
    const diffDays = (Date.now() - ticketDate.getTime()) / 86400000;
    if (diffDays > 1.5 || diffDays < -0.5) {
      return res.status(400).json({ detail: `車票日期（${parsed.dateStr}）非今日有效` });
    }
  }

  // 重複使用驗證（有 ticketKey 的格式才檢查）
  const userTicketKey = parsed.ticketKey ? `${sess.user_id}:${parsed.ticketKey}` : null;
  if (userTicketKey) {
    const [dupRows] = await pool.query(
      'SELECT id FROM journeys WHERE user_id=? AND ticket_serial=? LIMIT 1',
      [sess.user_id, userTicketKey]
    );
    if (dupRows.length > 0) {
      return res.status(409).json({ detail: '此車票已使用過，每張票只能收集一次印記' });
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const user = await getOrCreateUser(conn, sess.easycard_id);
    const pts  = dest.base_points + (dest.is_remote ? 500 : 0);
    const co2  = parseFloat((dest.dist_km * CO2_PER_KM).toFixed(3));

    await conn.query(
      'INSERT INTO journeys (user_id,end_station_id,distance_km,carbon_saved,points_earned,ticket_serial) VALUES (?,?,?,?,?,?)',
      [user.id, dest.id, dest.dist_km, co2, pts, userTicketKey]
    );
    const [stampResult] = await conn.query(
      'INSERT INTO user_stamps (user_id,station_id,visit_count,unlocked_at,last_visited_at) VALUES (?,?,1,NOW(),NOW()) ON DUPLICATE KEY UPDATE visit_count=visit_count+1,last_visited_at=NOW()',
      [user.id, dest.id]
    );
    const stampUnlocked = stampResult.affectedRows === 1;

    await conn.query(
      'UPDATE users SET total_points=total_points+?,total_rides=total_rides+1,total_carbon_saved=total_carbon_saved+?,total_km=total_km+? WHERE id=?',
      [pts, co2, dest.dist_km, user.id]
    );

    const newAchs          = await checkAndGrantAchievements(conn, user.id);
    const completedMissions = await checkMissions(conn, user.id, dest.id);

    await conn.commit();
    const [vc] = await conn.query('SELECT visit_count FROM user_stamps WHERE user_id=? AND station_id=?', [user.id, dest.id]);
    conn.release();

    res.json({
      success:            true,
      station:            dest.name,
      station_icon:       dest.icon,
      from_station:       fromSt?.name || null,
      from_icon:          fromSt?.icon || null,
      points_earned:      pts,
      co2_saved_kg:       co2,
      distance_km:        dest.dist_km,
      stamp_unlocked:     stampUnlocked,
      is_remote_bonus:    dest.is_remote,
      visit_count:        vc[0]?.visit_count || 1,
      new_achievements:   newAchs,
      completed_missions: completedMissions,
    });
  } catch (err) {
    await conn.rollback();
    conn.release();
    res.status(500).json({ detail: err.message });
  }
});

// ════════════════════════════════════════════
// MISSIONS
// ════════════════════════════════════════════
async function checkMissions(conn, userId, arrivedStationId) {
  const [missions]  = await conn.query('SELECT * FROM missions WHERE is_active=1');
  const [completed] = await conn.query('SELECT mission_id FROM user_missions WHERE user_id=?', [userId]);
  const doneIds     = new Set(completed.map(r => r.mission_id));
  const [user]      = await conn.query('SELECT * FROM users WHERE id=?', [userId]);
  const u           = user[0];
  const [stCntR]    = await conn.query('SELECT COUNT(*) as cnt FROM user_stamps WHERE user_id=?', [userId]);
  const stCnt       = stCntR[0].cnt;

  const newlyCompleted = [];
  for (const m of missions) {
    if (doneIds.has(m.id)) continue;
    let met = false;

    switch (m.code) {
      case 'VISIT_STATION':
        met = m.target_station_id === arrivedStationId; break;
      case 'RIDES_5':
        met = u.total_rides >= 5; break;
      case 'RIDES_10':
        met = u.total_rides >= 10; break;
      case 'STAMPS_5':
        met = stCnt >= 5; break;
      case 'CARBON_5':
        met = parseFloat(u.total_carbon_saved) >= 5; break;
      case 'VISIT_REMOTE':
        const remSt = STATIONS_LIST.find(s => s.id === arrivedStationId);
        met = remSt?.is_remote || false; break;
      case 'KEELUNG_PINGXI': // 基隆+七堵
        const [kp] = await conn.query(
          `SELECT COUNT(DISTINCT st.code) as cnt FROM user_stamps us
           JOIN stations st ON us.station_id=st.id
           WHERE us.user_id=? AND st.code IN ('KEL','QDU')`, [userId]
        );
        met = kp[0].cnt >= 2; break;
      case 'TAOYUAN_REACH':
        const toSt = STATIONS_LIST.find(s => s.id === arrivedStationId);
        met = toSt && ['TAO','ZLI','YME'].includes(toSt.code); break;
    }

    if (met) {
      await conn.query('INSERT IGNORE INTO user_missions (user_id,mission_id,completed_at) VALUES (?,?,NOW())', [userId, m.id]);
      await conn.query('UPDATE users SET total_points=total_points+? WHERE id=?', [m.points_reward, userId]);
      newlyCompleted.push({ id:m.id, title:m.title, icon:m.icon, points_reward:m.points_reward });
    }
  }
  return newlyCompleted;
}

app.get('/api/missions', async (req, res) => {
  const sess = getSession(req);
  try {
    const [all] = await pool.query('SELECT * FROM missions WHERE is_active=1 ORDER BY is_limited DESC, sort_order ASC');
    if (!sess) return res.json({ missions: all.map(m => ({...m, is_completed:false})) });

    const [done] = await pool.query('SELECT mission_id,completed_at FROM user_missions WHERE user_id=?', [sess.user_id]);
    const doneMap = {};
    done.forEach(r => { doneMap[r.mission_id] = r.completed_at; });

    res.json({
      missions: all.map(m => ({
        ...m,
        is_completed: m.id in doneMap,
        completed_at: doneMap[m.id] || null,
      }))
    });
  } catch (err) { res.status(500).json({ detail:err.message }); }
});

// ════════════════════════════════════════════
// ACHIEVEMENTS
// ════════════════════════════════════════════
app.get('/api/achievements', async (req, res) => {
  const sess = getSession(req);
  try {
    const [all] = await pool.query('SELECT * FROM achievements ORDER BY points ASC');
    if (!sess) return res.json({ achievements: all.map(a => ({...a, is_unlocked:false})) });

    const [unlocked] = await pool.query(
      'SELECT achievement_id,unlocked_at FROM user_achievements WHERE user_id=?', [sess.user_id]
    );
    const unlockedMap = {};
    unlocked.forEach(r => { unlockedMap[r.achievement_id] = r.unlocked_at; });

    res.json({
      achievements: all.map(a => ({
        ...a,
        is_unlocked: a.id in unlockedMap,
        unlocked_at: unlockedMap[a.id] || null,
      })),
      unlocked_count: unlocked.length,
      total: all.length,
    });
  } catch (err) { res.status(500).json({ detail:err.message }); }
});

// ════════════════════════════════════════════
// POINTS / REDEEM
// ════════════════════════════════════════════
app.get('/api/points/:easycard_id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE easycard_id=?', [req.params.easycard_id]);
    if (!rows.length) return res.json({ balance:0, total_co2_kg:0, total_km:0 });
    const u = rows[0];
    res.json({ balance:u.total_points, total_co2_kg:parseFloat(u.total_carbon_saved||0), total_km:parseFloat(u.total_km||0) });
  } catch (err) { res.status(500).json({ detail:err.message }); }
});

app.post('/api/points/:easycard_id/redeem/:reward_id', async (req, res) => {
  const sess = getSession(req);
  if (!sess) return res.status(401).json({ detail:'請先登入' });
  const reward = REWARDS.find(r => r.id === req.params.reward_id);
  if (!reward) return res.status(404).json({ detail:'獎勵不存在' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const user = await getOrCreateUser(conn, req.params.easycard_id);
    if (user.total_points < reward.cost) {
      conn.release();
      return res.status(400).json({ detail:`積分不足，還差 ${reward.cost-user.total_points} 積分` });
    }
    await conn.query('UPDATE users SET total_points=total_points-? WHERE id=?', [reward.cost, user.id]);
    await conn.query('INSERT INTO redeem_log (user_id,reward_id,reward_name,points_spent) VALUES (?,?,?,?)',
      [user.id, reward.id, reward.name, reward.cost]);
    await conn.commit();
    const [upd] = await conn.query('SELECT total_points FROM users WHERE id=?', [user.id]);
    conn.release();
    res.json({ status:'redeemed', reward_name:reward.name, points_spent:reward.cost, remaining_points:upd[0].total_points });
  } catch (err) {
    await conn.rollback(); conn.release();
    res.status(500).json({ detail:err.message });
  }
});

// ════════════════════════════════════════════
// LEADERBOARD / STATIONS
// ════════════════════════════════════════════
app.get('/api/leaderboard', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT COALESCE(display_name,name) as name, total_points, total_rides,
       (SELECT COUNT(*) FROM user_stamps WHERE user_id=users.id) as stamp_count,
       total_carbon_saved
       FROM users ORDER BY total_points DESC LIMIT 10`
    );
    res.json({ leaderboard: rows });
  } catch (err) { res.status(500).json({ detail:err.message }); }
});

app.get('/api/stations', (req, res) => {
  res.json({ success:true, stations: STATIONS_LIST });
});

// ════════════════════════════════════════════
// GENERATE QR CODE for a station (乘車碼)
// ════════════════════════════════════════════
app.get('/api/qr/:station_code', (req, res) => {
  const st = STATION_BY_CODE[req.params.station_code.toUpperCase()];
  if (!st) return res.status(404).json({ detail:'站點不存在' });
  // 產生一個帶時間戳的乘車碼 payload
  const payload = Buffer.from(JSON.stringify({
    code: st.code, name: st.name, ts: Date.now()
  })).toString('base64');
  res.json({ station: st, qr_payload: payload, hint: `RI:${st.code}:${Date.now()}` });
});

// SPA fallback
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 軌道印記 v4 啟動！http://localhost:${PORT}`);
  console.log(`🔑 模擬進站限定帳號：testuser / 123456`);
});
