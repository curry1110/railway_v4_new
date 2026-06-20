# 軌道印記 Railway Imprint v4

北北基桃台鐵遊戲化集章系統

## 快速啟動

```bash
# 1. 建資料庫（首次執行）
mysql -u root -p < schema.sql

# 2. 安裝依賴
npm install

# 3. 啟動伺服器
node server.js
```

開啟瀏覽器 → http://localhost:3000

---

## 帳號說明

| 帳號 | 密碼 | 權限 |
|------|------|------|
| testuser | 123456 | ✅ 可模擬進站、乘車碼掃碼觸發積分 |
| 其他帳號 | 自訂 | 🔒 乘車碼僅供查看，進站由悠遊卡 Webhook 觸發 |

---

## 新功能（v4）

### 🔐 模擬進站限定 testuser
- `POST /api/easycard/simulate-tap` — 後端驗證 session，非 testuser 回傳 403
- 前端 tap-card、地圖模擬按鈕、QR 模擬按鈕皆依帳號顯示/停用

### 📱 乘車碼（QR Code）
- 所有登入用戶均可開啟乘車碼 Modal，選擇站點顯示 QR
- QR payload 格式：`RI:{STATION_CODE}:{TIMESTAMP}:{CARD_ID}`
- testuser 在乘車碼 Modal 另有「模擬此站進站」按鈕

### 🏆 成就系統（13 種）
| 代碼 | 名稱 | 條件 | 積分 |
|------|------|------|------|
| FIRST_RIDE | 初試啼聲 | 第一次搭乘 | 100 |
| TEN_RIDES | 鐵道常客 | 搭乘 10 次 | 500 |
| THIRTY_RIDES | 鐵道狂人 | 搭乘 30 次 | 1500 |
| STAMP_5 | 印章新手 | 集 5 枚 | 300 |
| STAMP_10 | 印章達人 | 集 10 枚 | 800 |
| STAMP_ALL | 全線制霸 | 集滿 25 枚 | 5000 |
| CARBON_10 | 減碳先鋒 | 減碳 10 kg | 1000 |
| CARBON_50 | 環保英雄 | 減碳 50 kg | 3000 |
| LEGEND_1 | 傳說獵人 | 第一枚傳說印章 | 2000 |
| LEGEND_ALL | 傳說集結 | 全部 4 枚傳說 | 8000 |
| REMOTE_EXPLORER | 偏鄉探索家 | 訪偏遠站 | 600 |
| KEELUNG_TAIPEI | 基北一日遊 | 同日基隆+台北 | 400 |
| TAOYUAN_EXPLORER | 桃園踏查 | 抵桃園/中壢 | 600 |

### 🎯 任務系統（8 種）
- 每次模擬進站後自動檢查任務完成條件
- 限時任務有倒數截止時間
- 完成後顯示 Toast 提示並獲得積分

### 站點（25 站，基隆→新富）
基隆、三坑、八堵、七堵、百福、五堵、汐止、汐科、南港、松山、
台北、萬華、板橋、浮洲、樹林、南樹林、山佳、鶯歌、
桃園、內壢、中壢、埔心、楊梅、富岡、新富

