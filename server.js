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

// 1. 勇者血脈種子格式
const LegacySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    lastFloor: { type: Number, default: 0 },
    legacyGold: { type: Number, default: 0 },
    legacyAtk: { type: Number, default: 0 },
    legacyHp: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now }
});
const Legacy = mongoose.model('Legacy', LegacySchema);

// 2. 【全新】全服共享全球墓碑格式
const TombstoneSchema = new mongoose.Schema({
    name: String,
    floor: Number,
    lv: Number,
    cause: String,
    lastWords: String, // 遺言系統
    date: { type: Date, default: Date.now }
});
const Tombstone = mongoose.model('Tombstone', TombstoneSchema);

app.get('/', (req, res) => {
    res.send("⚔️ 命運深淵伺服器完美運作中！");
});

// 📥 【核心 API 升級】線上存檔 + 自動同步建立全服墓碑
app.post('/api/save', async (req, res) => {
    const { name, lastFloor, legacyGold, legacyAtk, legacyHp, cause, lastWords } = req.body;
    try {
        // (A) 更新或建立玩家嘅繼承血脈
        const updatedLegacy = await Legacy.findOneAndUpdate(
            { name: name },
            { lastFloor, legacyGold, legacyAtk, legacyHp, updatedAt: Date.now() },
            { new: true, upsert: true }
        );

        // (B) 自動在全球墓碑庫塞入一塊新石碑 (帶埋臨終遺言)
        const newTomb = new Tombstone({
            name,
            floor: lastFloor,
            lv: req.body.lv || 1,
            cause: cause || "未知魔物",
            lastWords: lastWords || "（這個勇者走得很安詳，沒有留下一句話...）"
        });
        await newTomb.save();

        res.json({ success: true, message: "✨ 雲端血脈與石碑立妥！", data: updatedLegacy });
    } catch (error) {
        res.status(500).json({ success: false, message: "❌ 雲端存檔失敗", error: error.message });
    }
});

// 📤 讀取血脈
app.get('/api/load/:name', async (req, res) => {
    try {
        const legacyData = await Legacy.findOne({ name: req.params.name });
        if (legacyData) res.json({ success: true, found: true, data: legacyData });
        else res.json({ success: true, found: false });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// 📤 【全新 API】抓取全伺服器全球最新嘅 5 塊玩家墓碑
app.get('/api/global-tombstones', async (req, res) => {
    try {
        const list = await Tombstone.find().sort({ date: -1 }).limit(5);
        res.json({ success: true, data: list });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 伺服器已在 Port ${PORT} 啟航！`);
});
