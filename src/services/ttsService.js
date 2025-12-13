// src/services/ttsService.js
const fsp = require("fs").promises;
const path = require("path");
const {
    ELEVENLABS_API_KEY,
    ELEVENLABS_VOICE_ID,
    ELEVENLABS_MODEL_ID,
} = require("../config/env");
const { AUDIO_DIR, ensureDir } = require("../utils/audio");
const { getUserVoiceId, resolveVoiceId } = require("../config/voice");

async function synthesizeToFile(text, filename, options = {}) {
    const { userId = null, presetKey = null, callSid = null } = options;

    if (!ELEVENLABS_API_KEY) {
        throw new Error("ELEVENLABS_API_KEY가 설정되지 않았습니다.");
    }

    // 기본 보이스는 fallback 용도(선택)
    if (!ELEVENLABS_VOICE_ID) {
        console.warn("⚠️ ELEVENLABS_VOICE_ID가 비어 있습니다. 프리셋/유저 보이스가 없으면 실패할 수 있습니다.");
    }

    await ensureDir(AUDIO_DIR);
    const audioFile = path.join(AUDIO_DIR, filename);

    // 1) presetKey -> 실제 voiceId (프리뷰/통화 시작 멘트 등에서 사용)
    const presetVoiceId = presetKey ? resolveVoiceId(presetKey, null) : null;

    // 2) userId -> DB(UserVoiceSetting) 기반 실제 voiceId
    const userVoiceId = userId ? await getUserVoiceId(userId) : null;

    // 3) 최종 voiceId 결정 우선순위: presetKey > user(DB) > default(env)
    let voiceId = ELEVENLABS_VOICE_ID || null;
    let voiceSource = "default";

    if (presetVoiceId) {
        voiceId = presetVoiceId;
        voiceSource = "presetKey";
    } else if (userVoiceId) {
        voiceId = userVoiceId;
        voiceSource = "user(UserVoiceSetting)";
    }

    if (!voiceId) {
        throw new Error("사용 가능한 voiceId가 없습니다. presetKey/userId/default 보이스 설정을 확인하세요.");
    }

    console.log("[TTS 선택]", {
        callSid: callSid || null,
        userId: userId || null,
        presetKey: presetKey || null,
        voiceId,
        voiceSource,
        userVoiceId: userVoiceId || null,
        filename,
        textPreview: (text || "").slice(0, 40),
    });

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
        console.error("[ElevenLabs TTS error]", {
            status: res.status,
            body,
            callSid: callSid || null,
            userId: userId || null,
            presetKey: presetKey || null,
            voiceId,
            voiceSource,
        });
        throw new Error(`ElevenLabs TTS 실패: HTTP ${res.status}`);
    }

    const arrayBuf = await res.arrayBuffer();
    await fsp.writeFile(audioFile, Buffer.from(arrayBuf));

    console.log("[TTS 완료 - ElevenLabs]", {
        audioFile,
        callSid: callSid || null,
        userId: userId || null,
        presetKey: presetKey || null,
        voiceId,
        voiceSource,
    });

    return audioFile;
}

module.exports = {
    synthesizeToFile,
};
