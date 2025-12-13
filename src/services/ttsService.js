// src/services/ttsService.js
const fsp = require("fs").promises;
const path = require("path");
const {
    ELEVENLABS_API_KEY,
    ELEVENLABS_VOICE_ID,
    ELEVENLABS_MODEL_ID,
} = require("../config/env");
const { AUDIO_DIR, ensureDir } = require("../utils/audio");
const { getUserVoiceId } = require("../config/voice");

async function synthesizeToFile(text, filename, options = {}) {
    const { userId = null, voiceIdOverride = null } = options;

    if (!ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) {
        throw new Error(
            "ELEVENLABS_API_KEY 또는 ELEVENLABS_VOICE_ID가 설정되지 않았습니다."
        );
    }

    await ensureDir(AUDIO_DIR);
    const audioFile = path.join(AUDIO_DIR, filename);

    // 다음 발화부터 적용: TTS 생성 요청 시점에 최신 voiceId를 조회해서 사용
    const voiceId = voiceIdOverride || (await getUserVoiceId(userId)) || ELEVENLABS_VOICE_ID;

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            text: text || "",
            model_id: ELEVENLABS_MODEL_ID,
        }),
    });

    if (!res.ok) {
        const body = await res.text();
        console.error("[ElevenLabs TTS error]", res.status, body);
        throw new Error(`ElevenLabs TTS 실패: HTTP ${res.status}`);
    }

    const arrayBuf = await res.arrayBuffer();
    await fsp.writeFile(audioFile, Buffer.from(arrayBuf));
    console.log("[TTS 완료 - ElevenLabs]", audioFile, "voiceId:", voiceId);

    return audioFile;
}

module.exports = {
    synthesizeToFile,
};
