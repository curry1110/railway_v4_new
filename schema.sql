CREATE DATABASE IF NOT EXISTS railway_imprint CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE railway_imprint;

DROP TABLE IF EXISTS user_achievements;
DROP TABLE IF EXISTS user_missions;
DROP TABLE IF EXISTS redeem_log;
DROP TABLE IF EXISTS user_stamps;
DROP TABLE IF EXISTS journeys;
DROP TABLE IF EXISTS missions;
DROP TABLE IF EXISTS achievements;
DROP TABLE IF EXISTS stations;
DROP TABLE IF EXISTS users;

-- 使用者
CREATE TABLE users (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  username           VARCHAR(50) UNIQUE,
  display_name       VARCHAR(50) DEFAULT '軌道旅人',
  pw_hash            VARCHAR(128),
  easycard_id        VARCHAR(20) NOT NULL UNIQUE,
  name               VARCHAR(50) DEFAULT '軌道旅人',
  total_points       INT DEFAULT 0,
  total_rides        INT DEFAULT 0,
  total_carbon_saved DECIMAL(8,3) DEFAULT 0.000,
  total_km           DECIMAL(8,2) DEFAULT 0.00,
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 站點（供 JOIN 用）
CREATE TABLE stations (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  code       VARCHAR(10) UNIQUE NOT NULL,
  name       VARCHAR(50) NOT NULL,
  line       VARCHAR(50),
  rarity     VARCHAR(20) DEFAULT 'common',
  is_remote  TINYINT(1) DEFAULT 0,
  dist_km    DECIMAL(6,2) DEFAULT 0,
  icon       VARCHAR(10),
  lat        DECIMAL(9,6),
  lng        DECIMAL(9,6)
);

-- 搭乘紀錄
CREATE TABLE journeys (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  user_id          INT NOT NULL,
  end_station_id   INT NOT NULL,
  distance_km      DECIMAL(6,2) DEFAULT 0,
  carbon_saved     DECIMAL(6,3) DEFAULT 0,
  points_earned    INT DEFAULT 0,
  ticket_serial    VARCHAR(255) NULL,
  traveled_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_ticket (user_id, ticket_serial),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 使用者印章
CREATE TABLE user_stamps (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NOT NULL,
  station_id      INT NOT NULL,
  visit_count     INT DEFAULT 1,
  unlocked_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_visited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_station (user_id, station_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 成就定義
CREATE TABLE achievements (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(50) UNIQUE NOT NULL,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  points      INT DEFAULT 0,
  icon        VARCHAR(10)
);

-- 使用者成就
CREATE TABLE user_achievements (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NOT NULL,
  achievement_id INT NOT NULL,
  unlocked_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_ach (user_id, achievement_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (achievement_id) REFERENCES achievements(id)
);

-- 任務定義
CREATE TABLE missions (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  code              VARCHAR(50) UNIQUE NOT NULL,
  title             VARCHAR(100) NOT NULL,
  description       TEXT,
  icon              VARCHAR(10) DEFAULT '🎯',
  points_reward     INT DEFAULT 0,
  target_station_id INT,
  is_limited        TINYINT(1) DEFAULT 0,
  is_active         TINYINT(1) DEFAULT 1,
  sort_order        INT DEFAULT 99,
  deadline          DATETIME
);

-- 使用者任務完成紀錄
CREATE TABLE user_missions (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  mission_id   INT NOT NULL,
  completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_mission (user_id, mission_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 兌換紀錄
CREATE TABLE redeem_log (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  reward_id    VARCHAR(10),
  reward_name  VARCHAR(100),
  points_spent INT,
  redeemed_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ── 站點資料 ──────────────────────────────
INSERT INTO stations (id,code,name,line,rarity,is_remote,dist_km,icon,lat,lng) VALUES
(1,'KEL','基隆','台鐵縱貫線','legendary',0,0,'⚓',25.1315,121.7400),
(2,'SKU','三坑','台鐵縱貫線','common',0,1.3,'🚉',25.1230,121.7310),
(3,'BAD','八堵','台鐵縱貫線','common',0,3.7,'🚉',25.1082,121.7289),
(4,'QDU','七堵','台鐵縱貫線','rare',1,6.0,'🚂',25.0975,121.7142),
(5,'BIF','百福','台鐵縱貫線','common',0,8.7,'🚉',25.0778,121.6936),
(6,'WUD','五堵','台鐵縱貫線','common',0,11.7,'🚉',25.0711,121.6706),
(7,'XZH','汐止','台鐵縱貫線','common',0,13.1,'🌊',25.0685,121.6611),
(8,'XKE','汐科','台鐵縱貫線','common',0,14.6,'🚉',25.0638,121.6468),
(9,'NNG','南港','台鐵縱貫線','common',0,19.1,'💡',25.0521,121.6068),
(10,'SHS','松山','台鐵縱貫線','common',0,21.9,'🏭',25.0491,121.5784),
(11,'TPE','台北','台鐵縱貫線','legendary',0,28.3,'🏛️',25.0478,121.5171),
(12,'WNH','萬華','台鐵縱貫線','common',0,31.1,'⛩️',25.0335,121.5000),
(13,'BQO','板橋','台鐵縱貫線','common',0,35.5,'🏡',25.0130,121.4637),
(14,'FUZ','浮洲','台鐵縱貫線','common',0,38.0,'🚉',25.0031,121.4444),
(15,'SLN','樹林','台鐵縱貫線','common',0,40.9,'🌲',24.9918,121.4244),
(16,'NSL','南樹林','台鐵縱貫線','common',0,42.9,'🚉',24.9818,121.4144),
(17,'SJA','山佳','台鐵縱貫線','common',0,44.8,'⛰️',24.9721,121.3900),
(18,'YGE','鶯歌','台鐵縱貫線','rare',0,49.2,'🏺',24.9547,121.3556),
(19,'TAO','桃園','台鐵縱貫線','legendary',0,57.4,'🍑',24.9894,121.3136),
(20,'NLI','內壢','台鐵縱貫線','common',0,63.3,'🚉',24.9725,121.2581),
(21,'ZLI','中壢','台鐵縱貫線','legendary',0,67.3,'🏙️',24.9536,121.2250),
(22,'PSN','埔心','台鐵縱貫線','common',0,73.1,'🚉',24.9192,121.1825),
(23,'YME','楊梅','台鐵縱貫線','common',0,77.1,'🌳',24.9136,121.1444),
(24,'FGA','富岡','台鐵縱貫線','rare',1,82.1,'🌾',24.9353,121.0833),
(25,'XFU','新富','台鐵縱貫線','rare',1,83.7,'🆕',24.9311,121.0667);

-- ── 成就 ──────────────────────────────────
INSERT INTO achievements (code,name,description,points,icon) VALUES
('FIRST_RIDE',      '初試啼聲',   '完成第一次搭乘',            100,  '🚀'),
('TEN_RIDES',       '鐵道常客',   '累計搭乘 10 次',            500,  '🎫'),
('THIRTY_RIDES',    '鐵道狂人',   '累計搭乘 30 次',            1500, '🚂'),
('STAMP_5',         '印章新手',   '收集 5 枚站點印章',         300,  '🎨'),
('STAMP_10',        '印章達人',   '收集 10 枚站點印章',        800,  '🖼️'),
('STAMP_ALL',       '全線制霸',   '收集全部 25 枚印章',        5000, '👑'),
('CARBON_10',       '減碳先鋒',   '累計減碳 10 kg',            1000, '🌿'),
('CARBON_50',       '環保英雄',   '累計減碳 50 kg',            3000, '🌍'),
('LEGEND_1',        '傳說獵人',   '收集到第一枚傳說印章',      2000, '🏆'),
('LEGEND_ALL',      '傳說集結',   '收集全部 4 枚傳說印章',     8000, '💎'),
('REMOTE_EXPLORER', '偏鄉探索家', '探訪偏遠站（七堵/富岡/新富）', 600, '🗺️'),
('KEELUNG_TAIPEI',  '基北一日遊', '同日搭乘基隆到台北',        400,  '🌉'),
('TAOYUAN_EXPLORER','桃園踏查',   '抵達桃園或中壢',            600,  '🍑');

-- ── 任務 ──────────────────────────────────
INSERT INTO missions (code,title,description,icon,points_reward,target_station_id,is_limited,is_active,sort_order,deadline) VALUES
('VISIT_STATION','基隆港都打卡',  '前往終點基隆站，解鎖傳說印章', '⚓',300, 1, 0,1,1,NULL),
('VISIT_REMOTE', '偏鄉勇者',     '探訪任一偏遠站（七堵/富岡/新富）','🗺️',500,NULL,1,1,2,DATE_ADD(NOW(),INTERVAL 12 HOUR)),
('RIDES_5',      '搭乘初體驗',   '累計搭乘 5 次',              '🎫',150,NULL,0,1,3,NULL),
('RIDES_10',     '鐵道玩家',     '累計搭乘 10 次',             '🚂',300,NULL,0,1,4,NULL),
('STAMPS_5',     '集章入門',     '收集 5 枚不同站點印章',      '🎨',200,NULL,0,1,5,NULL),
('CARBON_5',     '初級減碳',     '累計減碳達 5 kg',            '🌿',250,NULL,0,1,6,NULL),
('KEELUNG_PINGXI','基北雙城記',  '同時擁有基隆與七堵印章',     '🌉',400,NULL,0,1,7,NULL),
('TAOYUAN_REACH','桃園任務',     '搭車抵達桃園、楊梅或中壢',   '🍑',500,NULL,1,1,8,DATE_ADD(NOW(),INTERVAL 24 HOUR));

-- ── testuser（密碼 123456）────────────────
INSERT IGNORE INTO users (username,display_name,pw_hash,easycard_id,name,total_points,total_rides,total_carbon_saved,total_km) VALUES
('testuser','測試旅人','2765c657ce9e075a6eb010bb90a443af67c6485befc83bba8298b6634df8ecb1','TEST_CARD_001','測試旅人',1240,23,4.700,223.5);

INSERT IGNORE INTO user_stamps (user_id,station_id,visit_count)
SELECT u.id, s.id, 2 FROM users u
JOIN stations s ON s.code IN ('KEL','TPE','WNH','NNG')
WHERE u.username='testuser';
