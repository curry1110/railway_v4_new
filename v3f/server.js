const express = require('express');
const mysql   = require('mysql2/promise');
const cors    = require('cors');
const path    = require('path');
const crypto  = require('crypto');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 資料庫連線設定
// ==========================================
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '1234',        // ← 修改為你的密碼
  database: 'railway_imprint',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ==========================================
// Auth 工具
// ==========================================
const sessions = new Map(); // token -> { user_id, easycard_id, username, display_name }

function hashPassword(pw) {
  return crypto.createHash('sha256').update(pw + 'ri_salt_2024').digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function getSession(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  return token ? sessions.get(token) : null;
}

// ==========================================
// 站點靜態資料
// ==========================================
const STATIONS_LIST = [
  {"id":1, "code":"KEL", "name":"基隆", "line":"台鐵縱貫線", "rarity":"legendary", "base_points":100, "is_remote":false, "dist_km":0, "icon":"⚓", "lat":25.1315, "lng":121.7400},
  {"id":2, "code":"SKU", "name":"三坑", "line":"台鐵縱貫線", "rarity":"common", "base_points":50, "is_remote":false, "dist_km":1.3, "icon":"🚉", "lat":25.1230, "lng":121.7310},
  {"id":3, "code":"BAD", "name":"八堵", "line":"台鐵縱貫線", "rarity":"common", "base_points":50, "is_remote":false, "dist_km":3.7, "icon":"🚉", "lat":25.1082, "lng":121.7289},
  {"id":4, "code":"QDU", "name":"七堵", "line":"台鐵縱貫線", "rarity":"rare", "base_points":80, "is_remote":true, "dist_km":6.0, "icon":"🚂", "lat":25.0975, "lng":121.7142},
  {"id":5, "code":"BIF", "name":"百福", "line":"台鐵縱貫線", "rarity":"common", "base_points":50, "is_remote":false, "dist_km":8.7, "icon":"🚉", "lat":25.0778, "lng":121.6936},
  {"id":6, "code":"WUD", "name":"五堵", "line":"台鐵縱貫線", "rarity":"common", "base_points":50, "is_remote":false, "dist_km":11.7, "icon":"🚉", "lat":25.0711, "lng":121.6706},
  {"id":7, "code":"XZH", "name":"汐止", "line":"台鐵縱貫線", "rarity":"common", "base_points":50, "is_remote":false, "dist_km":13.1, "icon":"🌊", "lat":25.0685, "lng":121.6611},
  {"id":8, "code":"XKE", "name":"汐科", "line":"台鐵縱貫線", "rarity":"common", "base_points":50, "is_remote":false, "dist_km":14.6, "icon":"🚉", "lat":25.0638, "lng":121.6468},
  {"id":9, "code":"NNG", "name":"南港", "line":"台鐵縱貫線", "rarity":"common", "base_points":50, "is_remote":false, "dist_km":19.1, "icon":"💡", "lat":25.0521, "lng":121.6068},
  {"id":10, "code":"SHS", "name":"松山", "line":"台鐵縱貫線", "rarity":"common", "base_points":50, "is_remote":false, "dist_km":21.9, "icon":"🏭", "lat":25.0491, "lng":121.5784},
  {"id":11, "code":"TPE", "name":"台北", "line":"台鐵縱貫線", "rarity":"legendary", "base_points":80, "is_remote":false, "dist_km":28.3, "icon":"🏛️", "lat":25.0478, "lng":121.5171},
  {"id":12, "code":"WNH", "name":"萬華", "line":"台鐵縱貫線", "rarity":"common", "base_points":60, "is_remote":false, "dist_km":31.1, "icon":"⛩️", "lat":25.0335, "lng":121.5000},
  {"id":13, "code":"BQO", "name":"板橋", "line":"台鐵縱貫線", "rarity":"common", "base_points":50, "is_remote":false, "dist_km":35.5, "icon":"🏡", "lat":25.0130, "lng":121.4637},
  {"id":14, "code":"FUZ", "name":"浮洲", "line":"台鐵縱貫線", "rarity":"common", "base_points":50, "is_remote":false, "dist_km":38.0, "icon":"🚉", "lat":25.0031, "lng":121.4444},
  {"id":15, "code":"SLN", "name":"樹林", "line":"台鐵縱貫線", "rarity":"common", "base_points":50, "is_remote":false, "dist_km":40.9, "icon":"🚉", "lat":24.9918, "lng":121.4244},
  {"id":16, "code":"NSL", "name":"南樹林", "line":"台鐵縱貫線", "rarity":"common", "base_points":50, "is_remote":false, "dist_km":42.9, "icon":"🚉", "lat":24.9818, "lng":121.4144},
  {"id":17, "code":"SJA", "name":"山佳", "line":"台鐵縱貫線", "rarity":"common", "base_points":50, "is_remote":false, "dist_km":44.8, "icon":"🚉", "lat":24.9721, "lng":121.3900},
  {"id":18, "code":"YGE", "name":"鶯歌", "line":"台鐵縱貫線", "rarity":"rare", "base_points":70, "is_remote":false, "dist_km":49.2, "icon":"🏺", "lat":24.9547, "lng":121.3556},
  {"id":19, "code":"TAO", "name":"桃園", "line":"台鐵縱貫線", "rarity":"legendary", "base_points":80, "is_remote":false, "dist_km":57.4, "icon":"🍑", "lat":24.9894, "lng":121.3136},
  {"id":20, "code":"NLI", "name":"內壢", "line":"台鐵縱貫線", "rarity":"common", "base_points":50, "is_remote":false, "dist_km":63.3, "icon":"🚉", "lat":24.9725, "lng":121.2581},
  {"id":21, "code":"ZLI", "name":"中壢", "line":"台鐵縱貫線", "rarity":"legendary", "base_points":80, "is_remote":false, "dist_km":67.3, "icon":"🏙️", "lat":24.9536, "lng":121.2250},
  {"id":22, "code":"PSN", "name":"埔心", "line":"台鐵縱貫線", "rarity":"common", "base_points":50, "is_remote":false, "dist_km":73.1, "icon":"🚉", "lat":24.9192, "lng":121.1825},
  {"id":23, "code":"YME", "name":"楊梅", "line":"台鐵縱貫線", "rarity":"common", "base_points":50, "is_remote":false, "dist_km":77.1, "icon":"🌳", "lat":24.9136, "lng":121.1444},
  {"id":24, "code":"FGA", "name":"富岡", "line":"台鐵縱貫線", "rarity":"rare", "base_points":70, "is_remote":true, "dist_km":82.1, "icon":"🌾", "lat":24.9353, "lng":121.0833},
  {"id":25, "code":"XFU", "name":"新富", "line":"台鐵縱貫線", "rarity":"rare", "base_points":70, "is_remote":true, "dist_km":83.7, "icon":"🆕", "lat":24.9311, "lng":121.0667}
];

const STATION_BY_CODE = {};
STATIONS_LIST.forEach(s => { STATION_BY_CODE[s.code] = s; });

const CO2_PER_KM = 0.021;

// ==========================================
// 工具：取得或建立使用者
// ==========================================
async function getOrCreateUser(conn, easycard_id) {
  const [rows] = await conn.query('SELECT * FROM users WHERE easycard_id = ?', [easycard_id]);
  if (rows.length > 0) return rows[0];
  const [result] = await conn.query(
    'INSERT INTO users (easycard_id, name) VALUES (?, ?)',
    [easycard_id, `旅人_${easycard_id.slice(-4)}`]
  );
  return { id: result.insertId, easycard_id, name: `旅人_${easycard_id.slice(-4)}`, total_points: 0, total_rides: 0, total_carbon_saved: 0, total_km: 0 };
}

// ==========================================
// 工具：檢查成就
// ==========================================
async function checkAchievements(conn, userId) {
  const [user] = await conn.query('SELECT * FROM users WHERE id = ?', [userId]);
  const [stamps] = await conn.query('SELECT COUNT(*) as cnt FROM user_stamps WHERE user_id = ?', [userId]);
  const [legendary] = await conn.query('SELECT COUNT(*) as cnt FROM user_stamps us JOIN stations s ON us.station_id = s.id WHERE us.user_id = ? AND s.rarity = "legendary"', [userId]);
  
  const [achievements] = await conn.query('SELECT * FROM achievements');
  const [unlocked] = await conn.query('SELECT achievement_id FROM user_achievements WHERE user_id = ?', [userId]);
  const unlockedIds = new Set(unlocked.map(r => r.achievement_id));
  
  const newAchievements = [];
  
  for (const ach of achievements) {
    if (unlockedIds.has(ach.id)) continue;
    
    let isMet = false;
    switch (ach.code) {
      case 'FIRST_RIDE': isMet = user[0].total_rides >= 1; break;
      case 'TEN_RIDES': isMet = user[0].total_rides >= 10; break;
      case 'STAMP_COLLECTOR_5': isMet = stamps[0].cnt >= 5; break;
      case 'CARBON_SAVER_10': isMet = user[0].total_carbon_saved >= 10; break;
      case 'LEGEND_FINDER': isMet = legendary[0].cnt >= 1; break;
    }
    
    if (isMet) {
      await conn.query('INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?)', [userId, ach.id]);
      await conn.query('UPDATE users SET total_points = total_points + ? WHERE id = ?', [ach.points, userId]);
      newAchievements.push(ach);
    }
  }
  
  return newAchievements;
}

// ==========================================
// API Routes
// ==========================================

app.post('/api/auth/register', async (req, res) => {
  const { username, display_name, easycard_id, password } = req.body;
  if (!username || !display_name || !easycard_id || !password) return res.status(400).json({ detail: '缺少必要欄位' });

  const conn = await pool.getConnection();
  try {
    const [existing] = await conn.query('SELECT id FROM users WHERE username = ? OR easycard_id = ?', [username, easycard_id]);
    if (existing.length > 0) {
      conn.release();
      return res.status(400).json({ detail: '帳號或悠遊卡號已被使用' });
    }
    const pw_hash = hashPassword(password);
    const [result] = await conn.query(
      'INSERT INTO users (username, name, display_name, easycard_id, pw_hash) VALUES (?,?,?,?,?)',
      [username, display_name, display_name, easycard_id, pw_hash]
    );
    conn.release();
    const token = generateToken();
    sessions.set(token, { user_id: result.insertId, easycard_id, username, display_name });
    res.json({ token, username, display_name, easycard_id, message: '帳號建立成功' });
  } catch (err) {
    conn.release();
    res.status(500).json({ detail: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0) return res.status(401).json({ detail: '帳號或密碼錯誤' });
    const user = rows[0];
    if (user.pw_hash && user.pw_hash !== hashPassword(password)) return res.status(401).json({ detail: '帳號或密碼錯誤' });
    const token = generateToken();
    const display = user.display_name || user.name;
    sessions.set(token, { user_id: user.id, easycard_id: user.easycard_id, username: user.username || username, display_name: display });
    res.json({ token, username: user.username || username, display_name: display, easycard_id: user.easycard_id, message: '登入成功' });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.get('/api/auth/me', async (req, res) => {
  const sess = getSession(req);
  if (!sess) return res.status(401).json({ detail: '未登入' });
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [sess.user_id]);
    if (rows.length === 0) return res.status(404).json({ detail: '找不到使用者' });
    const u = rows[0];
    res.json({
      username: u.username,
      display_name: u.display_name || u.name,
      easycard_id: u.easycard_id,
      points: u.total_points,
      total_rides: u.total_rides,
      total_co2_kg: parseFloat(u.total_carbon_saved || 0),
      total_km: parseFloat(u.total_km || 0),
      created_at: u.created_at,
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.get('/api/stamps/:easycard_id', async (req, res) => {
  const { easycard_id } = req.params;
  try {
    const [userRows] = await pool.query('SELECT id FROM users WHERE easycard_id = ?', [easycard_id]);
    const userId = userRows.length > 0 ? userRows[0].id : -1;
    const [ownedRows] = await pool.query('SELECT station_id, visit_count FROM user_stamps WHERE user_id = ?', [userId]);
    const ownedMap = {};
    ownedRows.forEach(r => { ownedMap[r.station_id] = r.visit_count; });
    const stamps = STATIONS_LIST.map(st => ({
      station_code: st.code, station_name: st.name, line: st.line, rarity: st.rarity, icon: st.icon,
      is_unlocked: st.id in ownedMap,
      visit_count: ownedMap[st.id] || 0,
    }));
    res.json({ stamps, total_collected: Object.keys(ownedMap).length });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.post('/api/easycard/simulate-tap', async (req, res) => {
  const { card_id, station_code } = req.query;
  const dest = STATION_BY_CODE[station_code];
  if (!dest) return res.status(404).json({ detail: `找不到站點 ${station_code}` });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const user = await getOrCreateUser(conn, card_id);
    let pointsEarned = dest.base_points + (dest.is_remote ? 500 : 0);
    const distKm = dest.dist_km;
    const co2Saved = parseFloat((distKm * CO2_PER_KM).toFixed(3));

    await conn.query('INSERT INTO journeys (user_id, end_station_id, distance_km, carbon_saved, points_earned) VALUES (?,?,?,?,?)', [user.id, dest.id, distKm, co2Saved, pointsEarned]);
    
    const [result] = await conn.query(
      'INSERT INTO user_stamps (user_id, station_id, visit_count, unlocked_at, last_visited_at) VALUES (?,?,?,NOW(),NOW()) ON DUPLICATE KEY UPDATE visit_count = visit_count + 1, last_visited_at = NOW()',
      [user.id, dest.id, 1]
    );
    
    const stampUnlocked = result.affectedRows === 1;
    await conn.query('UPDATE users SET total_points=total_points+?, total_rides=total_rides+1, total_carbon_saved=total_carbon_saved+?, total_km=total_km+? WHERE id=?', [pointsEarned, co2Saved, distKm, user.id]);
    
    const newAchievements = await checkAchievements(conn, user.id);
    
    await conn.commit();
    const [updatedStamp] = await conn.query('SELECT visit_count FROM user_stamps WHERE user_id = ? AND station_id = ?', [user.id, dest.id]);
    const visitCount = updatedStamp[0]?.visit_count || 1;
    
    res.json({ 
      station: dest.name, 
      points_earned: pointsEarned, 
      co2_saved_kg: co2Saved, 
      distance_km: distKm, 
      stamp_unlocked: stampUnlocked, 
      stamp_icon: dest.icon,
      visit_count: visitCount,
      new_achievements: newAchievements
    });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ detail: err.message });
  } finally {
    conn.release();
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT display_name, total_points, total_rides, (SELECT COUNT(*) FROM user_stamps WHERE user_id = users.id) as stamp_count FROM users ORDER BY total_points DESC LIMIT 10'
    );
    res.json({ leaderboard: rows });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.get('/api/achievements/:user_id', async (req, res) => {
  const { user_id } = req.params;
  try {
    const [all] = await pool.query('SELECT * FROM achievements');
    const [unlocked] = await pool.query('SELECT achievement_id FROM user_achievements WHERE user_id = ?', [user_id]);
    const unlockedIds = new Set(unlocked.map(r => r.achievement_id));
    
    const achievements = all.map(ach => ({
      ...ach,
      is_unlocked: unlockedIds.has(ach.id)
    }));
    res.json({ achievements });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.post('/api/craft/tr-master', async (req, res) => {
  const sess = getSession(req);
  if (!sess) return res.status(401).json({ detail: '未登入' });
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [stamps] = await conn.query('SELECT COUNT(*) as cnt FROM user_stamps us JOIN stations s ON us.station_id = s.id WHERE us.user_id = ? AND s.line = "台鐵縱貫線"', [sess.user_id]);
    
    if (stamps[0].cnt < 25) {
      await conn.rollback();
      return res.status(400).json({ detail: '印章不足，需要收集所有 25 枚縱貫線印章' });
    }
    
    const [existing] = await conn.query('SELECT id FROM redeem_log WHERE user_id = ? AND reward_id = "CRAFT_TR_MASTER"', [sess.user_id]);
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(400).json({ detail: '您已經合成過此獎勵' });
    }
    
    await conn.query('INSERT INTO redeem_log (user_id, reward_id, reward_name, points_spent) VALUES (?, "CRAFT_TR_MASTER", "縱貫鐵道大章", 0)', [sess.user_id]);
    await conn.query('UPDATE users SET total_points = total_points + 5000 WHERE id = ?', [sess.user_id]);
    
    await conn.commit();
    res.json({ success: true, message: '合成成功！獲得「縱貫鐵道大章」與 5,000 積分', bonus_points: 5000 });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ detail: err.message });
  } finally {
    conn.release();
  }
});

app.get('/api/stations', (req, res) => {
  res.json({ success: true, stations: STATIONS_LIST });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
