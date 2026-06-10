const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// 讀取雲端環境變數 (保護密碼安全)
const MONGODB_URI = process.env.MONGODB_URI;
const PORT = process.env.PORT || 5000;

// 連接 MongoDB 雲端資料庫
if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI)
        .then(() => console.log("📡 成功與 MongoDB 雲端大腦同步！"))
        .catch(err => console.error("❌ 資料庫連線失敗:", err));
} else {
    console.log("⚠️ 警告: 尚未設定 MONGODB_URI 環境變數！");
}

// 測試用接口
app.get('/', (req, res) => {
    res.send("⚔️ 命運深淵雲端伺服器正在完美運行中！");
});

// 啟動伺服器
app.listen(PORT, () => {
    console.log(`🚀 伺服器已在 Port ${PORT} 拔劍啟航！`);
});