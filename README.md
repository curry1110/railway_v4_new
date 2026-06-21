# 軌道印記 Railway Imprint v4

北北基桃台鐵遊戲化集章系統

## 快速啟動

```bash
# 1. 建資料庫（首次執行）
mysql -u root -p < schema.sql

# 2. 安裝依賴
npm install

# 3.（選用）設定 Gemini AI 路線規劃，見下方「AI 智慧路線規劃」章節

# 4. 啟動伺服器
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

## ✨ AI 智慧路線（Gemini）

「推薦路線」頁面共有三處串接 Google Gemini，分工如下：

| 區塊 | 觸發方式 | API | 說明 |
|------|----------|-----|------|
| AI 智慧規劃 | 使用者按按鈕主動觸發 | `POST /api/ai-route-plan` | 整合收集進度、上車站、可用時間、個人偏好、進行中任務，請 AI 從零生成一趟完整客製路線 |
| 智慧推薦路線 | 進入頁面自動背景觸發 | `POST /api/ai-route-insights` | 既有的「依連續未收集區段」規則式推薦不變，AI 只是補上更吸睛的標題與一句話亮點 |
| 主題路線 | 進入頁面自動背景觸發 | `POST /api/ai-route-insights` | 既有的策展路線與收集進度不變，AI 補上依目前進度的個人化提示（如快集滿了、還缺幾站） |

### 設定步驟
1. 前往 [Google AI Studio](https://aistudio.google.com/apikey) 免費申請一組 API Key
2. 開啟 `server.js`，找到以下區塊，把 Key 貼進去：
   ```js
   const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY_HERE';
   ```
   或改用環境變數啟動，不需修改程式碼：
   ```bash
   GEMINI_API_KEY=你的key node server.js
   ```
3. 重新啟動伺服器即可。若未設定 Key，三處 AI 功能都會優雅降級：
   - AI 智慧規劃按鈕會顯示提醒訊息
   - 智慧推薦路線／主題路線會維持原本的靜態標題與文案，不影響基本功能

### 運作方式
- **AI 智慧規劃**（`POST /api/ai-route-plan`）：組合使用者狀態（已/未收集站點、上車站、可用時間、偏好、進行中任務）成 prompt，呼叫 Gemini（`gemini-2.5-flash`，可用 `GEMINI_MODEL` 環境變數更換）並要求以固定 JSON 結構回傳（`responseSchema`），前端顯示 AI 給的標題、推薦理由、依序停靠站點與小提醒
- **智慧推薦路線／主題路線增強**（`POST /api/ai-route-insights`）：後端重算目前的智慧推薦前 3 段路線、以及尚未集滿的主題路線，整理成精簡 JSON 交給 Gemini，請它針對每一段／每一條補上一句話文案；前端在原本的靜態卡片渲染完成後，於背景非同步呼叫此 API，成功才覆蓋上 AI 文案（卡片上會出現 ✨AI 標籤），失敗則靜默維持原樣，不會卡住畫面或顯示錯誤
- 兩個 API 都會驗證 AI 回傳的站碼／路線 index／路線 id，過濾掉任何不在目前資料範圍內的內容，避免 AI 幻覺或誤植資料影響系統

---

## 新功能（v4）

### 🧭 推薦路線：上車站 + 全面 AI 化
- 可指定今天的「上車站」（或自動定位最近站），系統會依距離調整智慧推薦路線排序
- 可使用 Gemini AI 從零規劃客製化路線（AI 智慧規劃）
- 智慧推薦路線、主題路線也都串接 AI，自動補上吸睛標題與個人化提示（詳見上方「AI 智慧路線」）

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

