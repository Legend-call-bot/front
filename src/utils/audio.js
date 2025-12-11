// src/utils/audio.js
const path = require("path");
const fs = require("fs");
const fsp = require("fs").promises;

const AUDIO_DIR = path.join(__dirname, "..", "..", "audio");

if (!fs.existsSync(AUDIO_DIR)) {
    fs.mkdirSync(AUDIO_DIR);
}

async function ensureDir(dir) {
    try {
        await fsp.mkdir(dir, { recursive: true });
    } catch (e) {
        // 이미 있으면 무시
    }
}

module.exports = {
    AUDIO_DIR,
    ensureDir,
};
