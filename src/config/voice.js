// src/config/voice.js
const {
    ELEVENLABS_VOICE_ID,
    ELEVENLABS_VOICE_ID_BRIGHT,
    ELEVENLABS_VOICE_ID_CLEAR,
    ELEVENLABS_VOICE_ID_CALM,
    ELEVENLABS_VOICE_ID_WARM,
} = require("./env");

// 서버 전체 기본 목소리 (엔그록/서버 재시작 시 초기값)
let CURRENT_VOICE_ID = ELEVENLABS_VOICE_ID;

// 프리셋 키 → env에 저장된 실제 ElevenLabs voice id
const VOICE_PRESET_MAP = {
    friendly_female: ELEVENLABS_VOICE_ID_BRIGHT,
    firm_female: ELEVENLABS_VOICE_ID_CLEAR,
    calm_female: ELEVENLABS_VOICE_ID_CALM,
    warm_female: ELEVENLABS_VOICE_ID_WARM,
};

function resolveVoiceId(presetKey, fallbackVoiceId) {
    if (presetKey && VOICE_PRESET_MAP[presetKey]) {
        return VOICE_PRESET_MAP[presetKey];
    }
    if (fallbackVoiceId) {
        return fallbackVoiceId;
    }
    if (CURRENT_VOICE_ID) {
        return CURRENT_VOICE_ID;
    }
    return ELEVENLABS_VOICE_ID;
}

function setCurrentVoiceId(voiceId) {
    CURRENT_VOICE_ID = voiceId;
}

module.exports = {
    VOICE_PRESET_MAP,
    resolveVoiceId,
    setCurrentVoiceId,
    get CURRENT_VOICE_ID() {
        return CURRENT_VOICE_ID;
    },
};
