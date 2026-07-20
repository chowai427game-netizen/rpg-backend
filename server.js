const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// ==========================================
// 🌐 跨來源資源共享 (CORS) 徹底配置
// 解決 GitHub Pages 呼叫 Render 後端時被瀏覽器同源政策封鎖的問題
// ==========================================
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '2mb' }));

const MONGODB_URI = process.env.MONGODB_URI;
const PORT = process.env.PORT || 5000;

// 📡 資料庫連線初始化
if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI)
        .then(() => console.log("📡 MongoDB 雲端大腦已完全同步！"))
        .catch(err => console.error("❌ 資料庫連線失敗:", err));
} else {
    console.warn("⚠️ 未偵測到 MONGODB_URI 環境變數，將運行為無資料庫模式。");
}

// ==========================================
// 📦 資料庫結構定義池 (Schemas)
// ==========================================

// 1. 勇者雲端永久進度存檔 (包含等級、經驗、6大屬性點數、倉庫、裝備及星級)
const ActiveProgressSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    playerObj: { type: Object, required: true }, 
    updatedAt: { type: Date, default: Date.now }
});
const ActiveProgress = mongoose.model('ActiveProgress', ActiveProgressSchema);

// 2. 歷史英靈殿與冒險記錄 (僅作為數據展示，絕不刪除角色主檔案)
const TombstoneSchema = new mongoose.Schema({
    name: String, 
    floor: Number, 
    lv: Number, 
    cause: String, 
    lastWords: String,
    date: { type: Date, default: Date.now }
});
const Tombstone = mongoose.model('Tombstone', TombstoneSchema);


// ==========================================
// 核心中央 API 路由控制器
// ==========================================

// 1. 喚醒伺服器 / 健康檢查端點 (專供前端 Loading 畫面 Ping 喚醒 Render 冷啟動)
app.get('/', (req, res) => { 
    res.send("⚔️ 命運深淵雲端儲存點伺服器運作中！"); 
});

// 2. 📥 【API 1】雲端存檔同步 (全面相容前端 activeChar / player / playerObj 格式)
const savePlayerHandler = async (req, res) => {
    const name = req.body.name;
    // 相容前端 state.js 發送的 activeChar 或傳統 playerObj 結構
    const playerData = req.body.activeChar || req.body.player || req.body.playerObj;

    if (!name || !playerData) {
        return res.status(400).json({ 
            success: false, 
            message: "❌ 缺少必要參數：必須包含 name 與 playerData/activeChar" 
        });
    }

    try {
        const savedChar = await ActiveProgress.findOneAndUpdate(
            { name: name },
            { playerObj: playerData, updatedAt: Date.now() },
            { new: true, upsert: true }
        );
        
        res.json({ 
            success: true, 
            message: "💾 雲端血脈與裝備已安全存檔！",
            updatedAt: savedChar.updatedAt
        });
    } catch (error) {
        console.error("❌ 雲端存檔失敗:", error);
        res.status(500).json({ success: false, message: "❌ 雲端備份失敗", error: error.message });
    }
};

// 雙路徑掛載，同時相容 /api/active/save 及舊版 /api/save 呼叫
app.post('/api/active/save', savePlayerHandler);
app.post('/api/save', savePlayerHandler);


// 3. 📤 【API 2】讀取勇者雲端檔案 (支援前端 initOrLoadPlayer / loadGameData)
app.get('/api/load/:name', async (req, res) => {
    const playerName = req.params.name;
    try {
        const activeData = await ActiveProgress.findOne({ name: playerName });
        
        res.json({
            success: true,
            name: playerName,
            activeChar: activeData ? activeData.playerObj : null 
        });
    } catch (error) {
        console.error("❌ 讀取存檔失敗:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});


// 4. 🪦 【API 3】紀錄討伐失敗或深淵紀錄 (只寫入英靈殿，絕不刪除角色檔)
app.post('/api/record-death', async (req, res) => {
    const { name, floor, lv, cause, lastWords } = req.body;
    try {
        const newTomb = new Tombstone({
            name: name || "無名勇者",
            floor: floor || 1,
            lv: lv || 1,
            cause: cause || "深淵魔物",
            lastWords: lastWords || "（雖然撤退了，但裝備與能力依然留在身上...）"
        });
        await newTomb.save();

        res.json({ success: true, message: "🪦 冒險紀錄已寫入英靈殿。" });
    } catch (error) { 
        res.status(500).json({ success: false, error: error.message }); 
    }
});


// 5. 📤 【API 4】抓取最新全球英靈榜
app.get('/api/global-tombstones', async (req, res) => {
    try {
        const list = await Tombstone.find().sort({ date: -1 }).limit(10);
        res.json({ success: true, data: list });
    } catch (error) { 
        res.status(500).json({ success: false, error: error.message }); 
    }
});


// 📡 開啟中央監聽閘門
app.listen(PORT, () => console.log(`🚀 命運深淵伺服器已在 Port ${PORT} 部署就緒！`));
