# 軌道印記 Railway Imprint v3.0

北北基桃鐵路遊戲化集章系統 — 前後端完整版

## 快速啟動（3步驟）

### 1. 建立資料庫
```bash
mysql -u root -p < schema.sql
```

### 2. 修改資料庫密碼
開啟 `server.js`，找到第 18 行，把 `password: '1234'` 改成你的 MySQL 密碼。

### 3. 啟動伺服器
```bash
npm install
node server.js
# 或
npm start
```

瀏覽器開啟 http://localhost:3000 即可使用。

---

## 新功能與更新

### 1. 乘車碼掃描功能
*   在首頁新增了「乘車碼掃描」卡片，點擊後可模擬掃描車站 QR Code 進行進站。
*   掃描後會隨機選取一個台鐵站點，並觸發進站邏輯，獲得積分與解鎖印章。

### 2. 擴充台鐵站點至新富
*   站點資料已擴充至北北基桃地區，最遠包含**新富站**。
*   所有新增站點皆包含正確的里程、積分與偏遠加成設定。

### 3. 前端架構優化 (CSS/JS 分離)
*   將原本內嵌在 `public/index.html` 中的 CSS 樣式提取至 `public/css/style.css`。
*   將 JavaScript 邏輯提取至 `public/js/app.js`，提升程式碼的可讀性與維護性。

### 4. 模擬進站權限控制
*   「模擬進站」功能（手動選擇站點）現在僅在登入**測試帳號**（`testuser`）時才會顯示於首頁。
*   一般使用者可透過「乘車碼掃描」或「地圖點擊」來模擬進站。

---

## API 端點總覽

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET  | /api/auth/me | 取得目前登入使用者的資料 |
| POST | /api/auth/register | 註冊新帳號 |
| POST | /api/auth/login | 登入帳號 |
| POST | /api/auth/logout | 登出帳號 |
| GET  | /api/auth/check | 檢查登入狀態 |
| GET  | /api/stamps/:easycard_id | 取得指定悠遊卡號的印章收集狀況 |
| GET  | /api/points/:easycard_id | 取得指定悠遊卡號的積分與減碳資料 |
| POST | /api/easycard/simulate-tap | 模擬悠遊卡進站（觸發積分與印章解鎖）|
| POST | /api/points/:easycard_id/redeem/:reward_id | 兌換獎勵 |
| GET  | /api/stations | 取得所有台鐵站點列表 |

### 模擬進站 API 範例
```json
POST /api/easycard/simulate-tap?card_id=TEST_CARD_001&station_code=TPE
```

回應：
```json
{
  "station": "台北",
  "points_earned": 80,
  "co2_saved_kg": 0.594,
  "distance_km": 28.3,
  "stamp_unlocked": true,
  "stamp_icon": "🏛️"
}
```

---

## 站點列表 (北北基桃台鐵縱貫線)

| ID | 代碼 | 站名 | 路線 | 稀有度 | 備註 |
|----|------|------|------|--------|------|
| 1  | KEL  | 基隆   | 台鐵縱貫線 | 傳說   | 起點站 |
| 2  | SKU  | 三坑   | 台鐵縱貫線 | 普通   | |
| 3  | BAD  | 八堵   | 台鐵縱貫線 | 普通   | |
| 4  | QDU  | 七堵   | 台鐵縱貫線 | 稀有   | 偏遠站點 +500 積分 |
| 5  | BIF  | 百福   | 台鐵縱貫線 | 普通   | |
| 6  | WUD  | 五堵   | 台鐵縱貫線 | 普通   | |
| 7  | XZH  | 汐止   | 台鐵縱貫線 | 普通   | |
| 8  | XKE  | 汐科   | 台鐵縱貫線 | 普通   | |
| 9  | NNG  | 南港   | 台鐵縱貫線 | 普通   | |
| 10 | SHS  | 松山   | 台鐵縱貫線 | 普通   | |
| 11 | TPE  | 台北   | 台鐵縱貫線 | 傳說   | 交通樞紐 |
| 12 | WNH  | 萬華   | 台鐵縱貫線 | 普通   | |
| 13 | BQO  | 板橋   | 台鐵縱貫線 | 普通   | |
| 14 | FUZ  | 浮洲   | 台鐵縱貫線 | 普通   | |
| 15 | SLN  | 樹林   | 台鐵縱貫線 | 普通   | |
| 16 | NSL  | 南樹林 | 台鐵縱貫線 | 普通   | |
| 17 | SJA  | 山佳   | 台鐵縱貫線 | 普通   | |
| 18 | YGE  | 鶯歌   | 台鐵縱貫線 | 稀有   | |
| 19 | TAO  | 桃園   | 台鐵縱貫線 | 傳說   | 交通樞紐 |
| 20 | NLI  | 內壢   | 台鐵縱貫線 | 普通   | |
| 21 | ZLI  | 中壢   | 台鐵縱貫線 | 傳說   | 交通樞紐 |
| 22 | PSN  | 埔心   | 台鐵縱貫線 | 普通   | |
| 23 | YME  | 楊梅   | 台鐵縱貫線 | 普通   | |
| 24 | FGA  | 富岡   | 台鐵縱貫線 | 稀有   | 偏遠站點 +500 積分 |
| 25 | XFU  | 新富   | 台鐵縱貫線 | 稀有   | 偏遠站點 +500 積分 |

---

## 專案結構

```
railway-imprint/
├── server.js          ← Express 後端（API + 靜態服務）
├── schema.sql         ← MySQL 建表腳本（執行一次）
├── package.json
├── public/
│   ├── index.html     ← 前端 App 入口
│   ├── css/
│   │   └── style.css  ← 獨立的 CSS 樣式表
│   └── js/
│       └── app.js     ← 獨立的 JavaScript 邏輯
└── node_modules/
```

---

## 正式上線建議

-   **資料庫**：目前使用 MySQL，可直接上線。
-   **部署**：可考慮 Railway.app / Render.com 等平台（通常有免費方案可用）。
-   **悠遊卡串接**：正式合作後，將 `/api/easycard/simulate-tap` 設為悠遊卡推播目標，並加入 HMAC-SHA256 簽章驗證，以確保資料安全性與交易安全。
