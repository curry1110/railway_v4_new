-- ==========================================
-- 軌道印記 Railway Imprint — 資料庫建置腳本
-- ==========================================

CREATE DATABASE IF NOT EXISTS railway_imprint CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE railway_imprint;

-- ==========================================
-- 使用者表
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  username            VARCHAR(50) UNIQUE COMMENT '登入帳號',
  display_name        VARCHAR(50) DEFAULT '軌道旅人' COMMENT '顯示名稱',
  pw_hash             VARCHAR(128) COMMENT 'SHA256 密碼雜湊',
  easycard_id         VARCHAR(20) NOT NULL UNIQUE COMMENT '悠遊卡卡號',
  name                VARCHAR(50) DEFAULT '軌道旅人',
  total_points        INT         DEFAULT 0,
  total_rides         INT         DEFAULT 0,
  total_carbon_saved  DECIMAL(10,3) DEFAULT 0.000,
  total_km            DECIMAL(10,2) DEFAULT 0.00,
  created_at          DATETIME    DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ==========================================
-- 站點表
-- ==========================================
CREATE TABLE IF NOT EXISTS stations (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(10) UNIQUE NOT NULL COMMENT '站點代碼',
  name          VARCHAR(50) NOT NULL COMMENT '站點名稱',
  line          VARCHAR(50) NOT NULL COMMENT '所屬路線',
  rarity        VARCHAR(20) NOT NULL COMMENT '稀有度',
  base_points   INT         DEFAULT 0 COMMENT '基礎積分',
  is_remote     TINYINT(1)  DEFAULT 0 COMMENT '是否為偏遠站點',
  dist_km       DECIMAL(6,2) DEFAULT 0.00 COMMENT '距離基隆站公里數',
  icon          VARCHAR(10) COMMENT '站點圖示'
);

-- ==========================================
-- 搭乘紀錄表
-- ==========================================
CREATE TABLE IF NOT EXISTS journeys (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  user_id           INT NOT NULL,
  start_station_id  INT,
  end_station_id    INT NOT NULL,
  distance_km       DECIMAL(6,2) DEFAULT 0,
  carbon_saved      DECIMAL(6,3) DEFAULT 0,
  points_earned     INT          DEFAULT 0,
  traveled_at       DATETIME     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (start_station_id) REFERENCES stations(id),
  FOREIGN KEY (end_station_id) REFERENCES stations(id)
);

-- ==========================================
-- 使用者印章表 (修正重複問題：增加唯一約束)
-- ==========================================
CREATE TABLE IF NOT EXISTS user_stamps (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  station_id  INT NOT NULL,
  visit_count INT DEFAULT 1 COMMENT '造訪次數',
  unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_visited_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_stamp (user_id, station_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (station_id) REFERENCES stations(id)
);

-- ==========================================
-- 成就定義表
-- ==========================================
CREATE TABLE IF NOT EXISTS achievements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  points INT DEFAULT 0,
  icon VARCHAR(20)
);

-- ==========================================
-- 使用者成就表
-- ==========================================
CREATE TABLE IF NOT EXISTS user_achievements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  achievement_id INT NOT NULL,
  unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_achievement (user_id, achievement_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (achievement_id) REFERENCES achievements(id)
);

-- ==========================================
-- 兌換/合成紀錄表
-- ==========================================
CREATE TABLE IF NOT EXISTS redeem_log (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  reward_id    VARCHAR(50),
  reward_name  VARCHAR(100),
  points_spent INT DEFAULT 0,
  redeemed_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ==========================================
-- 初始資料：站點 (25 個縱貫線站點)
-- ==========================================
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE stations;
SET FOREIGN_KEY_CHECKS = 1;
INSERT INTO stations (id, code, name, line, rarity, base_points, is_remote, dist_km, icon) VALUES
(1, 'KEL', '基隆', '台鐵縱貫線', 'legendary', 100, 0, 0.0, '⚓'),
(2, 'SKU', '三坑', '台鐵縱貫線', 'common', 50, 0, 1.3, '🚉'),
(3, 'BAD', '八堵', '台鐵縱貫線', 'common', 50, 0, 3.7, '🚉'),
(4, 'QDU', '七堵', '台鐵縱貫線', 'rare', 80, 1, 6.0, '🚂'),
(5, 'BIF', '百福', '台鐵縱貫線', 'common', 50, 0, 8.7, '🚉'),
(6, 'WUD', '五堵', '台鐵縱貫線', 'common', 50, 0, 11.7, '🚉'),
(7, 'XZH', '汐止', '台鐵縱貫線', 'common', 50, 0, 13.1, '🌊'),
(8, 'XKE', '汐科', '台鐵縱貫線', 'common', 50, 0, 14.6, '🚉'),
(9, 'NNG', '南港', '台鐵縱貫線', 'common', 50, 0, 19.1, '💡'),
(10, 'SHS', '松山', '台鐵縱貫線', 'common', 50, 0, 21.9, '🏭'),
(11, 'TPE', '台北', '台鐵縱貫線', 'legendary', 80, 0, 28.3, '🏛️'),
(12, 'WNH', '萬華', '台鐵縱貫線', 'common', 60, 0, 31.1, '⛩️'),
(13, 'BQO', '板橋', '台鐵縱貫線', 'common', 50, 0, 35.5, '🏡'),
(14, 'FUZ', '浮洲', '台鐵縱貫線', 'common', 50, 0, 38.0, '🚉'),
(15, 'SLN', '樹林', '台鐵縱貫線', 'common', 50, 0, 40.9, '🚉'),
(16, 'NSL', '南樹林', '台鐵縱貫線', 'common', 50, 0, 42.9, '🚉'),
(17, 'SJA', '山佳', '台鐵縱貫線', 'common', 50, 0, 44.8, '🚉'),
(18, 'YGE', '鶯歌', '台鐵縱貫線', 'rare', 70, 0, 49.2, '🏺'),
(19, 'TAO', '桃園', '台鐵縱貫線', 'legendary', 80, 0, 57.4, '🍑'),
(20, 'NLI', '內壢', '台鐵縱貫線', 'common', 50, 0, 63.3, '🚉'),
(21, 'ZLI', '中壢', '台鐵縱貫線', 'legendary', 80, 0, 67.3, '🏙️'),
(22, 'PSN', '埔心', '台鐵縱貫線', 'common', 50, 0, 73.1, '🚉'),
(23, 'YME', '楊梅', '台鐵縱貫線', 'common', 50, 0, 77.1, '🌳'),
(24, 'FGA', '富岡', '台鐵縱貫線', 'rare', 70, 1, 82.1, '🌾'),
(25, 'XFU', '新富', '台鐵縱貫線', 'rare', 70, 1, 83.7, '🆕');

-- ==========================================
-- 初始資料：成就
-- ==========================================
INSERT IGNORE INTO achievements (code, name, description, points, icon) VALUES
('FIRST_RIDE', '初試啼聲', '完成第一次搭乘', 100, '🚀'),
('TEN_RIDES', '鐵道常客', '累計搭乘達 10 次', 500, '🎫'),
('STAMP_COLLECTOR_5', '印章新手', '收集 5 枚不同站點印章', 300, '🎨'),
('CARBON_SAVER_10', '減碳先鋒', '累計減碳達 10kg', 1000, '🌿'),
('LEGEND_FINDER', '傳說獵人', '收集到第一枚傳說級印章', 2000, '🏆');

-- ==========================================
-- 測試資料：testuser (密碼 123456)
-- ==========================================
INSERT IGNORE INTO users (username, display_name, pw_hash, easycard_id, name, total_points, total_rides, total_carbon_saved, total_km) VALUES
('testuser', '測試旅人', '2765c657ce9e075a6eb010bb90a443af67c6485befc83bba8298b6634df8ecb1', 'TEST_CARD_001', '測試旅人', 1240, 23, 4.700, 223.5);
