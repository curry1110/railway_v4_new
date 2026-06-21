const express = require('express');
const mysql   = require('mysql2/promise');
const cors    = require('cors');
const path    = require('path');
const crypto  = require('crypto');
const { createWorker } = require('tesseract.js');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// ── DB Pool ────────────────────────────────
const pool = mysql.createPool({
  host: 'localhost', user: 'root', password: '1234',
  database: 'railway_imprint',
  waitForConnections: true, connectionLimit: 10, queueLimit: 0
});

// ── Gemini AI（AI 路線規劃）──────────────────
// 1. 至 https://aistudio.google.com/apikey 免費申請一組 API Key
// 2. 直接貼在下面的字串，或改用環境變數啟動：GEMINI_API_KEY=xxx node server.js
// 3. 可至 https://ai.google.dev/gemini-api/docs/models 查詢最新可用模型名稱
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY_HERE';
const GEMINI_MODEL   = process.env.GEMINI_MODEL   || 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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

// ── 主題推薦路線（靜態策展，提供旅遊靈感）────
const THEMED_ROUTES = [
  {id:'KEELUNG_HARBOR', title:'基隆海港半日遊',   desc:'從海港城市出發，探訪縱貫線最北端的傳說站與沿線小站',     icon:'⚓', tag:'親子・海景',     stations:['KEL','SKU','BAD','QDU']},
  {id:'TAIPEI_URBAN',   title:'雙北都會印章之旅', desc:'穿梭南港、松山到台北，集滿都會核心區印章',               icon:'🏙️', tag:'都會・捷運共構', stations:['NNG','SHS','TPE','WNH','BQO']},
  {id:'YINGGE_POTTERY', title:'鶯歌陶瓷小旅行',   desc:'山佳車站園區到鶯歌老街，感受百年陶瓷工藝',               icon:'🏺', tag:'文化・老街',     stations:['SJA','YGE']},
  {id:'TAOYUAN_MINI',   title:'桃園小旅行',       desc:'桃園、內壢到中壢，探索北台灣新興城市風貌',               icon:'🍑', tag:'城市探索',       stations:['TAO','NLI','ZLI']},
  {id:'REMOTE_HUNTER',  title:'偏鄉秘境探索線',   desc:'七堵、富岡、新富，三座偏遠站一次收錄，額外加碼高額積分', icon:'🗺️', tag:'秘境・高積分',   stations:['QDU','FGA','XFU']},
  {id:'LEGEND_TOUR',    title:'傳說四城巡禮',     desc:'一次集滿基隆、台北、桃園、中壢四枚傳說印章',             icon:'👑', tag:'傳說章・挑戰',   stations:['KEL','TPE','TAO','ZLI']},
];

// 站點推薦權重：稀有度 + 偏鄉加碼，分數越高代表越值得優先前往
function scoreStation(st) {
  let s = st.base_points;
  if (st.rarity === 'legendary') s += 600;
  else if (st.rarity === 'rare')  s += 250;
  if (st.is_remote) s += 500;
  return s;
}

const AVG_SPEED_KMH = 50; // 區間車平均估算時速，用於換算「距上車站預估時間」
// 計算「從上車站到目的站」的距離／方向／預估時間
// direction：up = 北上（往基隆方向，里程數變小）；down = 南下（往新富方向，里程數變大）；same = 同一站
function travelFrom(boardingStation, targetStation) {
  const distance_km = parseFloat(Math.abs(targetStation.dist_km - boardingStation.dist_km).toFixed(1));
  const direction = targetStation.dist_km === boardingStation.dist_km ? 'same'
    : targetStation.dist_km < boardingStation.dist_km ? 'up' : 'down';
  const est_minutes = distance_km === 0 ? 0 : Math.max(1, Math.round(distance_km / AVG_SPEED_KMH * 60));
  return { distance_km, direction, est_minutes };
}

// 將尚未收集的站點依「沿線連續區段」分組，作為一趟可一次走完的建議路線
// boardingStation（選填）：若提供上車站，會額外標註每段路線距上車站的距離／方向／預估時間，
// 並讓排序同時考慮「離上車站多近」，而不只是純粹的印章價值分數
function buildSegments(uncollectedIdSet, boardingStation) {
  const segments = [];
  let cur = [];
  for (const st of STATIONS_LIST) {
    if (uncollectedIdSet.has(st.id)) {
      cur.push(st);
    } else if (cur.length) {
      segments.push(cur); cur = [];
    }
  }
  if (cur.length) segments.push(cur);

  return segments.map(seg => {
    const legendary_count = seg.filter(s => s.rarity === 'legendary').length;
    const rare_count      = seg.filter(s => s.rarity === 'rare').length;
    const remote_count    = seg.filter(s => s.is_remote).length;
    const total_points    = seg.reduce((sum, s) => sum + s.base_points + (s.is_remote ? 500 : 0), 0);
    const distance_km     = parseFloat((seg[seg.length - 1].dist_km - seg[0].dist_km).toFixed(1));
    const score           = seg.reduce((sum, s) => sum + scoreStation(s), 0);

    let travel = null;
    if (boardingStation) {
      const tStart = travelFrom(boardingStation, seg[0]);
      const tEnd   = travelFrom(boardingStation, seg[seg.length - 1]);
      const nearer = tStart.distance_km <= tEnd.distance_km ? { st: seg[0], t: tStart } : { st: seg[seg.length - 1], t: tEnd };
      travel = {
        nearest_station: nearer.st.name,
        distance_from_boarding_km: nearer.t.distance_km,
        est_minutes: nearer.t.est_minutes,
        direction: nearer.t.direction,
      };
    }

    return {
      from: seg[0].name, to: seg[seg.length - 1].name,
      stations: seg.map(s => ({ code:s.code, name:s.name, icon:s.icon, rarity:s.rarity, is_remote:s.is_remote, base_points:s.base_points })),
      count: seg.length, legendary_count, rare_count, remote_count, total_points, distance_km, score, travel,
    };
  });
}

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

// ════════════════════════════════════════════
// TICKET OCR (fallback when QR can't be read/decoded
// — e.g. real TRA paper tickets use an official encrypted
// QR payload this system cannot parse, so we read the
// printed station names instead)
// ════════════════════════════════════════════
let ocrWorkerPromise = null;
function getOcrWorker() {
  if (!ocrWorkerPromise) {
    // 使用 npm 套件內建的訓練資料（避免依賴外部 CDN，部署環境網路若有限制也能運作）
    const langPath = path.join(
      __dirname, 'node_modules', '@tesseract.js-data', 'chi_tra', '4.0.0_best_int'
    );
    ocrWorkerPromise = createWorker('chi_tra', 1, { langPath, cachePath: langPath, gzip: true });
    // 若初始化失敗，清掉快取的 promise，避免之後每次呼叫都卡在同一個壞掉的 promise 上
    ocrWorkerPromise.catch(() => { ocrWorkerPromise = null; });
  }
  return ocrWorkerPromise;
}

// 台鐵票面慣用「臺」異體字（如「臺北」），但站名清單採「台」，
// 比對時正規化成同一字再找，兩邊都能對上。
function normalizeStationText(s) {
  return s.replace(/臺/g, '台');
}

// 每站「去除常見共用字後的辨識度最高字」，OCR 抓不到完整站名時，
// 用單一不會跟其他站混淆的字當作低信心候選（仍須使用者於畫面上確認，不會自動收集）。
// 站名中含有與他站重複用字的（如「堵」「汐」「南」「山」「樹」「林」「壢」「富」），不建立單字 fallback。
const AMBIGUOUS_CHARS = new Set(['堵', '汐', '南', '山', '樹', '林', '壢', '富']);
function buildUniqueCharIndex() {
  const idx = {};
  STATIONS_LIST.forEach(st => {
    const name = normalizeStationText(st.name);
    // 用站名最後一個字（台鐵站名慣例上多為辨識度最高的字），且該字不可在 AMBIGUOUS_CHARS 內
    const lastChar = name[name.length - 1];
    if (!AMBIGUOUS_CHARS.has(lastChar)) {
      // 確認沒有其他站名也以同一字結尾，避免誤判
      const collision = STATIONS_LIST.some(other => other.code !== st.code && normalizeStationText(other.name).endsWith(lastChar));
      if (!collision) idx[lastChar] = st;
    }
  });
  return idx;
}
const UNIQUE_CHAR_INDEX = buildUniqueCharIndex();

// 在辨識出的全文中，依站名「出現位置」找出候選站，
// 因為台鐵票面慣例是「上面＝出發站、下面＝到達站」，
// 用文字在原始字串中的 index 排序即可還原順序。
function matchStationsInText(text) {
  const clean = normalizeStationText(text.replace(/\s+/g, ''));
  const hits = [];
  const matchedCodes = new Set();

  // Tier 1：完整站名比對（高信心）
  for (const st of STATIONS_LIST) {
    const idx = clean.indexOf(normalizeStationText(st.name));
    if (idx !== -1) {
      hits.push({ ...st, _idx: idx, _confidence: 'full' });
      matchedCodes.add(st.code);
    }
  }

  // Tier 2：完整站名比對不到時，用不易混淆的單字 fallback（低信心，僅作建議）
  if (hits.length < 2) {
    for (const [char, st] of Object.entries(UNIQUE_CHAR_INDEX)) {
      if (matchedCodes.has(st.code)) continue;
      const idx = clean.indexOf(char);
      if (idx !== -1) {
        hits.push({ ...st, _idx: idx, _confidence: 'partial' });
        matchedCodes.add(st.code);
      }
    }
  }

  hits.sort((a, b) => a._idx - b._idx);
  return hits;
}

app.post('/api/ticket/ocr', async (req, res) => {
  const sess = getSession(req);
  if (!sess) return res.status(401).json({ detail: '請先登入' });

  const { image_base64 } = req.body;
  if (!image_base64) return res.status(400).json({ detail: '缺少車票圖片' });

  // 圖片大小防護（base64 約為原檔 1.33 倍，10mb body limit 已留餘裕）
  let buf;
  try {
    const base64Data = image_base64.replace(/^data:image\/\w+;base64,/, '');
    buf = Buffer.from(base64Data, 'base64');
    if (buf.length === 0) throw new Error('empty');
  } catch (_) {
    return res.status(400).json({ detail: '圖片資料格式錯誤' });
  }

  try {
    const worker = await getOcrWorker();
    const { data } = await worker.recognize(buf);
    const rawText = data.text || '';
    const candidates = matchStationsInText(rawText);

    if (candidates.length === 0) {
      return res.status(404).json({
        detail: '無法從圖片中辨識出車站名稱，請確認照片清晰、車站名稱完整入鏡，或改用手動輸入車站',
      });
    }

    // 票面慣例：上面（先出現）＝出發站，下面（後出現）＝到達站
    const fromSt = candidates[0];
    const toSt   = candidates.length > 1 ? candidates[candidates.length - 1] : null;
    const lowConfidence = candidates.some(c => c._confidence === 'partial');

    res.json({
      success: true,
      from: fromSt ? { code: fromSt.code, name: fromSt.name, icon: fromSt.icon } : null,
      to:   toSt   ? { code: toSt.code,   name: toSt.name,   icon: toSt.icon }   : null,
      // 只有一站被辨識到時，視為到達站（單純比對到一個站名，無法確定方向）
      single: candidates.length === 1 ? { code: fromSt.code, name: fromSt.name, icon: fromSt.icon } : null,
      low_confidence: lowConfidence,
    });
  } catch (err) {
    console.error('OCR error:', err && err.stack ? err.stack : err);
    res.status(500).json({ detail: 'OCR 辨識發生錯誤，請改用下方「手動輸入車站」' });
  }
});

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

// ════════════════════════════════════════════
// RECOMMENDED ROUTES（推薦路線）
// ════════════════════════════════════════════
app.get('/api/recommend-routes', async (req, res) => {
  const sess = getSession(req);
  if (!sess) return res.status(401).json({ detail:'請先登入' });

  try {
    const [userRows] = await pool.query('SELECT * FROM users WHERE id=?', [sess.user_id]);
    const user = userRows[0];
    if (!user) return res.status(404).json({ detail:'找不到使用者' });

    const [ownedRows] = await pool.query('SELECT station_id FROM user_stamps WHERE user_id=?', [user.id]);
    const ownedSet     = new Set(ownedRows.map(r => r.station_id));
    const uncollected  = STATIONS_LIST.filter(s => !ownedSet.has(s.id));

    // ── 上車站（選填）：使用者可指定今天從哪一站上車，系統會依此調整推薦 ──
    const boardingCode = (req.query.boarding_station || '').toUpperCase().trim();
    const boardingStation = boardingCode ? (STATION_BY_CODE[boardingCode] || null) : null;
    const DIST_PENALTY_PER_KM = 8; // 每公里對推薦分數的懲罰權重，讓「近」與「印章價值高」取得平衡

    // ── 智慧推薦路線：依未收集印章的「連續區段」自動分組 ──
    let smartRoutes = [];
    let nextBest = null;
    if (uncollected.length > 0) {
      const segs = buildSegments(new Set(uncollected.map(s => s.id)), boardingStation);
      segs.sort((a, b) => {
        const aAdj = a.score - (a.travel ? a.travel.distance_from_boarding_km * DIST_PENALTY_PER_KM : 0);
        const bAdj = b.score - (b.travel ? b.travel.distance_from_boarding_km * DIST_PENALTY_PER_KM : 0);
        return bAdj - aAdj;
      });
      smartRoutes = segs.slice(0, 3).map(seg => {
        const bonusBits = [];
        if (seg.legendary_count) bonusBits.push(`含 ${seg.legendary_count} 枚傳說章`);
        if (seg.rare_count)      bonusBits.push(`${seg.rare_count} 枚稀有章`);
        if (seg.remote_count)    bonusBits.push(`${seg.remote_count} 個偏鄉加碼站`);
        const travelBits = seg.travel
          ? [`距上車站 ${seg.travel.distance_from_boarding_km} km`, `約 ${seg.travel.est_minutes} 分鐘`, seg.travel.direction === 'up' ? '北上方向' : seg.travel.direction === 'down' ? '南下方向' : '就在上車站']
          : [];
        return {
          ...seg,
          title: seg.count === 1 ? `直奔 ${seg.from}` : `${seg.from} → ${seg.to}`,
          summary: `${seg.count} 站・最高可得 ${seg.total_points} 積分` + (bonusBits.length ? `・${bonusBits.join('・')}` : ''),
          travel_summary: travelBits.length ? travelBits.join('・') : null,
        };
      });

      let best;
      if (boardingStation) {
        best = [...uncollected]
          .map(s => ({ st: s, t: travelFrom(boardingStation, s), adj: scoreStation(s) - travelFrom(boardingStation, s).distance_km * DIST_PENALTY_PER_KM }))
          .sort((a, b) => b.adj - a.adj)[0];
        nextBest = best ? {
          code: best.st.code, name: best.st.name, icon: best.st.icon, rarity: best.st.rarity,
          is_remote: best.st.is_remote, points: best.st.base_points + (best.st.is_remote ? 500 : 0),
          travel: { distance_km: best.t.distance_km, est_minutes: best.t.est_minutes, direction: best.t.direction },
        } : null;
      } else {
        const top = [...uncollected].sort((a, b) => scoreStation(b) - scoreStation(a))[0];
        nextBest = top ? {
          code: top.code, name: top.name, icon: top.icon, rarity: top.rarity,
          is_remote: top.is_remote, points: top.base_points + (top.is_remote ? 500 : 0),
          travel: null,
        } : null;
      }
    }

    // ── 任務導向路線：把進行中任務轉換成「該去哪幾站」 ──
    const [missions]  = await pool.query('SELECT * FROM missions WHERE is_active=1 ORDER BY sort_order ASC');
    const [doneRows]  = await pool.query('SELECT mission_id FROM user_missions WHERE user_id=?', [user.id]);
    const doneSet     = new Set(doneRows.map(r => r.mission_id));
    const remoteCodes  = new Set(['QDU','FGA','XFU']);
    const taoyuanCodes = new Set(['TAO','ZLI','YME']);

    const missionRoutes = [];
    for (const m of missions) {
      if (doneSet.has(m.id)) continue;
      let stations = [];
      let note = null;
      switch (m.code) {
        case 'VISIT_STATION': {
          const st = STATIONS_LIST.find(s => s.id === m.target_station_id);
          if (st && !ownedSet.has(st.id)) stations = [st];
          break;
        }
        case 'VISIT_REMOTE':
          stations = uncollected.filter(s => remoteCodes.has(s.code)).slice(0, 1);
          if (!stations.length) note = '尚未完成，建議重新確認偏遠站搭乘紀錄';
          break;
        case 'KEELUNG_PINGXI':
          stations = uncollected.filter(s => ['KEL','QDU'].includes(s.code));
          break;
        case 'TAOYUAN_REACH':
          stations = uncollected.filter(s => taoyuanCodes.has(s.code)).slice(0, 1);
          if (!stations.length) note = '可能已搭乘但任務尚未觸發，建議重新確認';
          break;
        case 'STAMPS_5':
          stations = uncollected.slice(0, 5);
          note = '完成其中任 5 站皆可達成任務';
          break;
        case 'RIDES_5':
          note = `再搭乘 ${Math.max(0, 5 - user.total_rides)} 次即可完成`; break;
        case 'RIDES_10':
          note = `再搭乘 ${Math.max(0, 10 - user.total_rides)} 次即可完成`; break;
        case 'CARBON_5':
          note = `再累積 ${Math.max(0, 5 - parseFloat(user.total_carbon_saved || 0)).toFixed(1)} kg 減碳即可完成`; break;
      }
      missionRoutes.push({
        mission_id: m.id, code: m.code, title: m.title, icon: m.icon,
        points_reward: m.points_reward, is_limited: !!m.is_limited, deadline: m.deadline,
        stations: stations.map(s => ({ code:s.code, name:s.name, icon:s.icon, rarity:s.rarity, is_remote:s.is_remote })),
        note,
      });
    }

    // ── 主題路線：靜態策展，附上目前收集進度 ──
    const themedRoutes = THEMED_ROUTES.map(t => {
      const stationObjs = t.stations.map(code => STATION_BY_CODE[code]);
      const collected    = stationObjs.filter(s => ownedSet.has(s.id)).length;
      return {
        id: t.id, title: t.title, desc: t.desc, icon: t.icon, tag: t.tag,
        stations: stationObjs.map(s => ({ code:s.code, name:s.name, icon:s.icon, rarity:s.rarity, is_remote:s.is_remote })),
        collected_count: collected, total: stationObjs.length,
        all_collected: collected === stationObjs.length,
      };
    });

    res.json({
      total_uncollected: uncollected.length,
      boarding_station: boardingStation ? { code: boardingStation.code, name: boardingStation.name, icon: boardingStation.icon } : null,
      next_best: nextBest,
      smart_routes: smartRoutes,
      mission_routes: missionRoutes,
      themed_routes: themedRoutes,
    });
  } catch (err) { res.status(500).json({ detail: err.message }); }
});

// ════════════════════════════════════════════
// AI 強化：智慧推薦路線 ＋ 主題路線（Gemini）
// 針對「智慧推薦路線」與「主題路線」兩個區塊，請 AI 補上更吸睛的標題／
// 一句話推薦理由，前端會以漸進式增強的方式覆蓋在原本的靜態卡片上；
// 若 AI 服務不可用，前端維持原本的靜態文字，不影響基本功能。
// ════════════════════════════════════════════
app.post('/api/ai-route-insights', async (req, res) => {
  const sess = getSession(req);
  if (!sess) return res.status(401).json({ detail:'請先登入' });

  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    return res.status(503).json({ detail:'尚未設定 Gemini API Key' });
  }

  try {
    const [userRows] = await pool.query('SELECT * FROM users WHERE id=?', [sess.user_id]);
    const user = userRows[0];
    if (!user) return res.status(404).json({ detail:'找不到使用者' });

    const [ownedRows] = await pool.query('SELECT station_id FROM user_stamps WHERE user_id=?', [user.id]);
    const ownedSet    = new Set(ownedRows.map(r => r.station_id));
    const uncollected = STATIONS_LIST.filter(s => !ownedSet.has(s.id));

    const boardingCode    = (req.body.boarding_station || '').toString().toUpperCase().trim();
    const boardingStation = boardingCode ? (STATION_BY_CODE[boardingCode] || null) : null;

    // ── 智慧推薦路線（與 /recommend-routes 相同的前 3 段排序邏輯）──
    let smartForAi = [];
    if (uncollected.length > 0) {
      const DIST_PENALTY_PER_KM = 8;
      const segs = buildSegments(new Set(uncollected.map(s => s.id)), boardingStation);
      segs.sort((a, b) => {
        const aAdj = a.score - (a.travel ? a.travel.distance_from_boarding_km * DIST_PENALTY_PER_KM : 0);
        const bAdj = b.score - (b.travel ? b.travel.distance_from_boarding_km * DIST_PENALTY_PER_KM : 0);
        return bAdj - aAdj;
      });
      smartForAi = segs.slice(0, 3).map((seg, idx) => ({
        index: idx,
        起站: seg.from, 迄站: seg.to, 站數: seg.count, 可得積分: seg.total_points,
        含傳說章數: seg.legendary_count, 含稀有章數: seg.rare_count, 偏鄉站數: seg.remote_count,
      }));
    }

    // ── 主題路線：只挑尚未完成的，附上目前收集進度 ──
    const themedForAi = THEMED_ROUTES.map(t => {
      const stationObjs = t.stations.map(code => STATION_BY_CODE[code]);
      const collected    = stationObjs.filter(s => ownedSet.has(s.id)).length;
      return { id: t.id, title: t.title, 簡介: t.desc, 已收集: collected, 總站數: stationObjs.length };
    }).filter(t => t.已收集 < t.總站數);

    if (smartForAi.length === 0 && themedForAi.length === 0) {
      return res.json({ smart: [], themed: [] });
    }

    const promptText = `你是台鐵「北北基桃」沿線集章遊戲「軌道印記」的文案顧問。請針對以下兩組路線資料，分別補上更吸引人的一句話文案，幫助使用者更想點進去看。

要求：
1. 「智慧推薦路線」每一段請補上 ai_title（8字以內，吸睛、像活動標語，可參考起站迄站但不必照搬）與 ai_blurb（1句話，15字以內，說明為何值得去，可提及傳說章／稀有章／偏鄉加碼等亮點）。
2. 「主題路線」每一條請補上 ai_note（1句話，20字以內，依目前收集進度給予個人化的鼓勵或提示，例如快完成了、還缺幾站等）。
3. 全程使用繁體中文（台灣用語），語氣活潑親切，不要使用驚嘆號以外的誇張符號。
4. index 與 id 必須完全對應到輸入資料，不可新增或省略項目。

智慧推薦路線（JSON）：
${JSON.stringify(smartForAi, null, 2)}

主題路線（JSON）：
${JSON.stringify(themedForAi, null, 2)}`;

    const responseSchema = {
      type: 'object',
      properties: {
        smart: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              index:    { type: 'integer' },
              ai_title: { type: 'string' },
              ai_blurb: { type: 'string' },
            },
            required: ['index', 'ai_title', 'ai_blurb'],
          },
        },
        themed: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id:      { type: 'string' },
              ai_note: { type: 'string' },
            },
            required: ['id', 'ai_note'],
          },
        },
      },
      required: ['smart', 'themed'],
    };

    let apiRes;
    try {
      apiRes = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          generationConfig: { responseMimeType: 'application/json', responseSchema, temperature: 0.9 },
        }),
      });
    } catch (netErr) {
      return res.status(502).json({ detail:'無法連線至 Gemini AI 服務' });
    }

    if (!apiRes.ok) {
      const errText = await apiRes.text().catch(() => '');
      console.error('Gemini API error (route-insights):', apiRes.status, errText);
      return res.status(502).json({ detail:`AI 服務暫時無法使用（${apiRes.status}）` });
    }

    const apiData = await apiRes.json();
    const rawText = apiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return res.status(502).json({ detail:'AI 未回傳有效內容' });

    let plan;
    try { plan = JSON.parse(rawText); }
    catch { return res.status(502).json({ detail:'AI 回應格式錯誤' }); }

    // ── 驗證：index 必須落在範圍內、id 必須存在於主題路線清單，避免幻覺資料 ──
    const validSmartIdx = new Set(smartForAi.map(s => s.index));
    const themedIdSet   = new Set(themedForAi.map(t => t.id));

    const smart = (Array.isArray(plan.smart) ? plan.smart : [])
      .filter(s => s && Number.isInteger(s.index) && validSmartIdx.has(s.index))
      .map(s => ({
        index: s.index,
        ai_title: (s.ai_title || '').toString().slice(0, 30),
        ai_blurb: (s.ai_blurb || '').toString().slice(0, 60),
      }));

    const themed = (Array.isArray(plan.themed) ? plan.themed : [])
      .filter(t => t && typeof t.id === 'string' && themedIdSet.has(t.id))
      .map(t => ({ id: t.id, ai_note: (t.ai_note || '').toString().slice(0, 60) }));

    res.json({ smart, themed });
  } catch (err) {
    console.error('AI route insights error:', err);
    res.status(500).json({ detail: err.message });
  }
});

// ════════════════════════════════════════════
// AI 智慧路線規劃（Gemini）
// ════════════════════════════════════════════
app.post('/api/ai-route-plan', async (req, res) => {
  const sess = getSession(req);
  if (!sess) return res.status(401).json({ detail:'請先登入' });

  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    return res.status(503).json({ detail:'尚未設定 Gemini API Key，請參考 README 設定教學申請並填入後端設定' });
  }

  try {
    const [userRows] = await pool.query('SELECT * FROM users WHERE id=?', [sess.user_id]);
    const user = userRows[0];
    if (!user) return res.status(404).json({ detail:'找不到使用者' });

    const [ownedRows] = await pool.query('SELECT station_id FROM user_stamps WHERE user_id=?', [user.id]);
    const ownedSet    = new Set(ownedRows.map(r => r.station_id));
    const uncollected = STATIONS_LIST.filter(s => !ownedSet.has(s.id));
    if (uncollected.length === 0) {
      return res.json({ all_collected: true });
    }

    const boardingCode    = (req.body.boarding_station || '').toString().toUpperCase().trim();
    const boardingStation = boardingCode ? (STATION_BY_CODE[boardingCode] || null) : null;
    const timeBudgetRaw    = parseInt(req.body.time_budget_minutes, 10);
    const timeBudget       = Number.isFinite(timeBudgetRaw) && timeBudgetRaw > 0 ? timeBudgetRaw : null;
    const preference       = (req.body.preference || '').toString().trim().slice(0, 100); // 限制長度，降低 prompt injection 風險

    const [missions] = await pool.query('SELECT * FROM missions WHERE is_active=1 ORDER BY sort_order ASC');
    const [doneRows] = await pool.query('SELECT mission_id FROM user_missions WHERE user_id=?', [user.id]);
    const doneSet     = new Set(doneRows.map(r => r.mission_id));
    const activeMissions = missions.filter(m => !doneSet.has(m.id))
      .map(m => ({ 任務: m.title, 說明: m.description, 獎勵積分: m.points_reward }));

    const stateForAi = {
      已收集站點: STATIONS_LIST.filter(s => ownedSet.has(s.id)).map(s => s.name),
      尚未收集站點: uncollected.map(s => ({
        站碼: s.code, 名稱: s.name, 稀有度: s.rarity, 是否偏遠站: s.is_remote, 沿線里程km: s.dist_km, 基本積分: s.base_points,
      })),
      今日上車站: boardingStation ? boardingStation.name : '未指定',
      可用時間分鐘: timeBudget || '未指定',
      使用者偏好: preference || '無特別偏好',
      進行中任務: activeMissions,
      使用者統計: { 累計搭乘次數: user.total_rides, 累計積分: user.total_points, 累計減碳公斤: user.total_carbon_saved },
    };

    const promptText = `你是台鐵「北北基桃」沿線集章遊戲「軌道印記」的路線規劃顧問。請根據以下使用者狀態，規劃一趟今天適合的集章路線。

規則：
1. stops 只能從「尚未收集站點」清單中挑選，不可挑選已收集站點，station_code 必須完全等於清單中的「站碼」欄位，不可自行創造站碼。
2. 若「今日上車站」非「未指定」，請優先安排距離該站較近、方向順路（同一方向，避免來回折返）的站點。
3. 若「可用時間分鐘」非「未指定」，請估算路線所需時間（全線平均時速約 50 km/h）不超過此時間。
4. 若「使用者偏好」非「無特別偏好」，請納入考量並回應在 narrative 或 tip；若偏好內容與路線規劃無關或不合理，可忽略。
5. 優先考慮稀有度高（legendary > rare > common）與偏遠站（是否偏遠站）的站點，因為集章與積分價值較高，但仍須兼顧路線合理性。
6. 可參考「進行中任務」，若安排的站點恰好能完成任務，可在 narrative 或 tip 提及。
7. stops 建議安排 2 到 5 站，不要過多造成負擔；若使用者已幾乎集滿，可少於 2 站。
8. 全程使用繁體中文（台灣用語），語氣親切、像在地朋友報路線。

使用者狀態（JSON）：
${JSON.stringify(stateForAi, null, 2)}`;

    const responseSchema = {
      type: 'object',
      properties: {
        title:     { type: 'string', description: '這趟路線的吸引人標題，15 字以內' },
        narrative: { type: 'string', description: '用親切鼓勵的語氣說明為什麼推薦這個路線，2-4 句話' },
        stops: {
          type: 'array',
          description: '建議依序造訪的站點，依台鐵縱貫線實際方向排序',
          items: {
            type: 'object',
            properties: {
              station_code: { type: 'string', description: '必須完全等於「尚未收集站點」清單中的站碼' },
              station_name: { type: 'string' },
              reason:       { type: 'string', description: '為什麼推薦造訪這一站，1 句話' },
            },
            required: ['station_code', 'station_name', 'reason'],
          },
        },
        total_distance_km: { type: 'number', description: '路線總里程估算（公里）' },
        estimated_minutes: { type: 'number', description: '路線所需時間估算（分鐘）' },
        tip: { type: 'string', description: '一句旅行小提醒或集章策略建議' },
      },
      required: ['title', 'narrative', 'stops', 'tip'],
    };

    let apiRes;
    try {
      apiRes = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          generationConfig: { responseMimeType: 'application/json', responseSchema, temperature: 0.8 },
        }),
      });
    } catch (netErr) {
      return res.status(502).json({ detail:'無法連線至 Gemini AI 服務，請檢查網路連線' });
    }

    if (!apiRes.ok) {
      const errText = await apiRes.text().catch(() => '');
      console.error('Gemini API error:', apiRes.status, errText);
      const msg = apiRes.status === 400 ? 'Gemini API Key 或設定有誤'
        : apiRes.status === 403 ? 'Gemini API Key 無效或無權限'
        : apiRes.status === 429 ? 'AI 服務目前請求過多，請稍後再試'
        : `AI 服務暫時無法使用（${apiRes.status}）`;
      return res.status(502).json({ detail: msg });
    }

    const apiData = await apiRes.json();
    const rawText = apiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return res.status(502).json({ detail:'AI 未回傳有效內容，請稍後再試' });

    let plan;
    try { plan = JSON.parse(rawText); }
    catch { return res.status(502).json({ detail:'AI 回應格式錯誤，請再試一次' }); }

    // ── 驗證 AI 回傳的站點，過濾掉幻覺站碼或已收集站點，確保前端資料一定可信 ──
    const uncollectedCodes = new Set(uncollected.map(s => s.code));
    const validStops = (Array.isArray(plan.stops) ? plan.stops : [])
      .filter(s => s && typeof s.station_code === 'string' && uncollectedCodes.has(s.station_code.toUpperCase()))
      .map(s => {
        const st = STATION_BY_CODE[s.station_code.toUpperCase()];
        return {
          code: st.code, name: st.name, icon: st.icon, rarity: st.rarity, is_remote: st.is_remote,
          base_points: st.base_points, reason: (s.reason || '').toString().slice(0, 120),
        };
      });

    if (validStops.length === 0) {
      return res.status(502).json({ detail:'AI 規劃的站點無法對應到目前未收集的站點，請再試一次' });
    }

    const total_points = validStops.reduce((sum, s) => sum + s.base_points + (s.is_remote ? 500 : 0), 0);

    res.json({
      title: (plan.title || 'AI 推薦路線').toString().slice(0, 40),
      narrative: (plan.narrative || '').toString().slice(0, 300),
      tip: (plan.tip || '').toString().slice(0, 200),
      stops: validStops,
      total_points,
      total_distance_km: typeof plan.total_distance_km === 'number' ? plan.total_distance_km : null,
      estimated_minutes: typeof plan.estimated_minutes === 'number' ? plan.estimated_minutes : null,
      boarding_station: boardingStation ? { code: boardingStation.code, name: boardingStation.name, icon: boardingStation.icon } : null,
    });
  } catch (err) {
    console.error('AI route plan error:', err);
    res.status(500).json({ detail: err.message });
  }
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
