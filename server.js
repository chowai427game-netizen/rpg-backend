const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http'); // 💡 新增：Node.js 原生 HTTP 模組
const { Server } = require('socket.io'); // 💡 新增：Socket.io 伺服器

const app = express();
const server = http.createServer(app); // 💡 將 Express 包裹進 HTTP 伺服器

// ==========================================
// 🌐 CORS 跨網域配置
// ==========================================
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '2mb' }));

const MONGODB_URI = process.env.MONGODB_URI;
const PORT = process.env.PORT || 5000;

// 📡 資料庫連線
if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI)
        .then(() => console.log("📡 MongoDB 雲端大腦已完全同步！"))
        .catch(err => console.error("❌ 資料庫連線失敗:", err));
} else {
    console.warn("⚠️ 未偵測到 MONGODB_URI 環境變數，將運行為無資料庫模式。");
}

// ==========================================
// 📦 Schema 定義 (新增 PIN 碼欄位)
// ==========================================
const ActiveProgressSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    pin: { type: String, required: true }, // 🔒 6 位數身份驗證 PIN 碼
    playerObj: { type: Object, required: true }, 
    updatedAt: { type: Date, default: Date.now }
});
const ActiveProgress = mongoose.model('ActiveProgress', ActiveProgressSchema);

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
// 💬 廣場即時聊天系統 (RAM 暫存，不存 MongoDB，極致省流量)
// ==========================================
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// 🛑 伺服器記憶體內存（只留最新 20 條廣播，Render 休眠會自動清空，不佔資料庫容量）
let squareChatHistory = [];

// 📡 線上勇者計數器
let onlineCount = 0;

// 📡 線上勇者計數器
let onlineCount = 0;

io.on("connection", (socket) => {
    // 增加連線人數並廣播給所有人
    onlineCount++;
    io.emit("update_online_count", onlineCount);

    // 1. 新玩家進入廣場連線時，直接發送記憶體內的最新 20 條紀錄
    socket.emit("init_chat_history", squareChatHistory);

    // 2. 收到玩家發送的訊息
    socket.on("send_square_chat", (data) => {
        if (!data || !data.msg || data.msg.trim() === "") return;

        const chatData = {
            name: data.name || "無名勇者",
            msg: data.msg.substring(0, 50) // 限制單條文字長度最大 50 字
        };

        squareChatHistory.push(chatData);

        if (squareChatHistory.length > 20) {
            squareChatHistory.shift();
        }

        io.emit("receive_square_chat", chatData);
    });

    // 3. 玩家斷開連線時扣除人數
    socket.on("disconnect", () => {
        onlineCount = Math.max(0, onlineCount - 1);
        io.emit("update_online_count", onlineCount);
    });
});

// ==========================================
// 核心路由控制器
// ==========================================

// 1. 健康檢查 / 喚醒端點
app.get('/', (req, res) => { 
    res.send("⚔️ 命運深淵雲端儲存點伺服器運作中！"); 
});

// 2. 🔑 【API 0】身份驗證 / 登入檢測端點
app.post('/api/auth/login', async (req, res) => {
    const { name, pin } = req.body;

    if (!name || !pin || pin.length !== 6) {
        return res.status(400).json({ success: false, message: "❌ 請輸入有效的勇者名稱與 6 位數 PIN 碼！" });
    }

    try {
        const existingUser = await ActiveProgress.findOne({ name: name });

        if (!existingUser) {
            return res.json({
                success: true,
                isNewUser: true,
                message: "✨ 尚未發現此血脈，將為你創建新角色！"
            });
        }

        if (existingUser.pin && existingUser.pin !== pin) {
            return res.status(401).json({
                success: false,
                message: "🔐 PIN 碼驗證失敗！此血脈已被其他勇者封印。"
            });
        }

        if (!existingUser.pin) {
            existingUser.pin = pin;
            await existingUser.save();
        }

        return res.json({
            success: true,
            isNewUser: false,
            activeChar: existingUser.playerObj,
            message: `🔑 解鎖成功！歡迎回來，${name}。`
        });

    } catch (error) {
        console.error("❌ 身份驗證失敗:", error);
        res.status(500).json({ success: false, message: "❌ 伺服器驗證異常", error: error.message });
    }
});

// 3. 💾 【API 1】雲端存檔同步 (包含 PIN 碼防護)
const savePlayerHandler = async (req, res) => {
    const { name, pin } = req.body;
    const playerData = req.body.activeChar || req.body.player || req.body.playerObj;

    if (!name || !pin || !playerData) {
        return res.status(400).json({ 
            success: false, 
            message: "❌ 缺少必要參數：必須包含 name, pin 與 activeChar" 
        });
    }

    try {
        const existingUser = await ActiveProgress.findOne({ name: name });

        if (existingUser && existingUser.pin && existingUser.pin !== pin) {
            return res.status(403).json({ success: false, message: "⛔ 權限不足：PIN 碼不符，拒絕覆蓋存檔！" });
        }

        const savedChar = await ActiveProgress.findOneAndUpdate(
            { name: name },
            { pin: pin, playerObj: playerData, updatedAt: Date.now() },
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

app.post('/api/active/save', savePlayerHandler);
app.post('/api/save', savePlayerHandler);

// 4. 📤 【API 2】傳統讀取端點
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
        res.status(500).json({ success: false, error: error.message });
    }
});

// 5. 🪦 【API 3】紀錄英靈殿
app.post('/api/record-death', async (req, res) => {
    const { name, floor, lv, cause, lastWords } = req.body;
    try {
        const newTomb = new Tombstone({
            name: name || "無名勇者",
            floor: floor || 1,
            lv: lv || 1,
            cause: cause || "深淵魔物",
            lastWords: lastWords || "（撤退返回地表...）"
        });
        await newTomb.save();
        res.json({ success: true, message: "🪦 冒險紀錄已寫入英靈殿。" });
    } catch (error) { 
        res.status(500).json({ success: false, error: error.message }); 
    }
});

// 6. 📤 【API 4】英靈榜
app.get('/api/global-tombstones', async (req, res) => {
    try {
        const list = await Tombstone.find().sort({ date: -1 }).limit(10);
        res.json({ success: true, data: list });
    } catch (error) { 
        res.status(500).json({ success: false, error: error.message }); 
    }
});

// 💡 注意：這裡改用 server.listen 啟動 HTTP + Socket.io 伺服器
server.listen(PORT, () => console.log(`🚀 命運深淵伺服器已在 Port ${PORT} 部署就緒！`));
