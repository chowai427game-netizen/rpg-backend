const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const MONGODB_URI = process.env.MONGODB_URI;
const PORT = process.env.PORT || 5000;

if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI)
        .then(() => console.log("📡 MongoDB 雲端大腦已完全同步！"))
        .catch(err => console.error("❌ 資料庫連線失敗:", err));
}

// // ==========================================
// // 資料庫結構定義池 (Schemas)
// // ==========================================

// 1. 勇者死後血脈繼承種子
const LegacySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    lastFloor: { type: Number, default: 0 },
    legacyGold: { type: Number, default: 0 },
    legacyAtk: { type: Number, default: 0 },
    legacyHp: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now }
});
const Legacy = mongoose.model('Legacy', LegacySchema);

// 2. 全服共享全球墓碑
const TombstoneSchema = new mongoose.Schema({
    name: String, floor: Number, lv: Number, cause: String, lastWords: String,
    date: { type: Date, default: Date.now }
});
const Tombstone = mongoose.model('Tombstone', TombstoneSchema);

// 3. 安全村莊活人進度存檔 (儲存點系統)
const ActiveProgressSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    playerObj: { type: Object, required: true }, 
    updatedAt: { type: Date, default: Date.now }
});
const ActiveProgress = mongoose.model('ActiveProgress', ActiveProgressSchema);


// // ==========================================
// // 核心中央 API 路由控制器
// // ==========================================

app.get('/', (req, res) => { res.send("⚔️ 命運深淵雲端儲存點伺服器運作中！"); });

// 📥 【API 1】在村莊點擊儲存，鎖定現世活人進度
app.post('/api/active/save', async (req, res) => {
    const { name, player } = req.body;
    try {
        const savedChar = await ActiveProgress.findOneAndUpdate(
            { name: name },
            { playerObj: player, updatedAt: Date.now() },
            { new: true, upsert: true }
        );
        res.json({ success: true, message: "💾 村莊儲存點同步成功！進度已安全鎖定雲端。" });
    } catch (error) {
        res.status(500).json({ success: false, message: "❌ 雲端備份失敗", error: error.message });
    }
});

// 📥 【API 2】勇者戰死結算：建立血脈並【強制粉碎抹除】活人存檔
app.post('/api/save', async (req, res) => {
    const { name, lastFloor, legacyGold, legacyAtk, legacyHp, cause, lastWords } = req.body;
    try {
        // (A) 寫入傳承種子
        await Legacy.findOneAndUpdate(
            { name: name },
            { lastFloor, legacyGold, legacyAtk, legacyHp, updatedAt: Date.now() },
            { upsert: true }
        );
        // (B) 立全球墓碑
        const newTomb = new Tombstone({
            name, floor: lastFloor, lv: req.body.lv || 1, cause: cause || "未知魔物",
            lastWords: lastWords || "（這個勇者走得很安詳...）"
        });
        await newTomb.save();

        // (C) 💥 戰死代表現世結束，立刻永久抹除村莊活人存檔，防止作弊
        await ActiveProgress.deleteOne({ name: name });

        res.json({ success: true, message: "✨ 魂歸英靈殿，現世存檔已粉碎清空。" });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// 📤 【API 3】綜合查詢：一鍵同時抓取「遺產種子」與「活人存檔」
app.get('/api/load/:name', async (req, res) => {
    try {
        const legacyData = await Legacy.findOne({ name: req.params.name });
        const activeData = await ActiveProgress.findOne({ name: req.params.name });
        
        res.json({
            success: true,
            legacy: legacyData ? legacyData : null,
            activeChar: activeData ? activeData.playerObj : null 
        });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// 📤 【API 4】抓取最新全球墓碑
app.get('/api/global-tombstones', async (req, res) => {
    try {
        const list = await Tombstone.find().sort({ date: -1 }).limit(5);
        res.json({ success: true, data: list });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// 📡 開啟中央監聽閘門
app.listen(PORT, () => console.log(`🚀 儲存點伺服器已在 Port ${PORT} 部署就緒！`));
