// src/config/voice.js
const {
    ELEVENLABS_VOICE_ID,
    ELEVENLABS_VOICE_ID_BRIGHT,
    ELEVENLABS_VOICE_ID_CLEAR,
    ELEVENLABS_VOICE_ID_CALM,
    ELEVENLABS_VOICE_ID_WARM,
} = require("./env");

const prisma = require("../db/prisma");

// 서버 전체 기본 목소리 (서버 재시작 시 초기값)
let DEFAULT_VOICE_ID = ELEVENLABS_VOICE_ID;

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
    if (DEFAULT_VOICE_ID) {
        return DEFAULT_VOICE_ID;
    }
    return ELEVENLABS_VOICE_ID;
}

/**
 * 사용자 설정을 DB에서 읽어서 "실제 voiceId"를 반환한다.
 * - voicePreset이 있으면 프리셋 매핑 우선
 * - 없으면 voiceId 사용
 * - 없으면 서버 기본값 fallback
 */
async function getUserVoiceId(userId) {
    if (!userId) {
        return resolveVoiceId(null, null);
    }

    const setting = await prisma.userVoiceSetting.findUnique({
        where: { userId },
        select: {
            voicePreset: true,
            voiceId: true,
        },
    });

    if (!setting) {
        return resolveVoiceId(null, null);
    }

    return resolveVoiceId(setting.voicePreset, setting.voiceId);
}

/**
 * 사용자 음성 설정 저장(업서트)
 * - presetKey 또는 voiceId 중 하나만 보내도 됨
 * - 둘 다 보내면 presetKey 우선으로 사용되지만, 저장은 둘 다 해도 무방
 */
async function setUserVoiceSetting(userId, { presetKey = null, voiceId = null }) {
    if (!userId) {
        throw new Error("userId is required");
    }

    await prisma.userVoiceSetting.upsert({
        where: { userId },
        create: {
            userId,
            voicePreset: presetKey,
            voiceId,
        },
        update: {
            voicePreset: presetKey,
            voiceId,
        },
    });
}

function setDefaultVoiceId(voiceId) {
    DEFAULT_VOICE_ID = voiceId;
}

module.exports = {
    VOICE_PRESET_MAP,
    resolveVoiceId,

    // 서버 기본값
    setDefaultVoiceId,
    get DEFAULT_VOICE_ID() {
        return DEFAULT_VOICE_ID;
    },

    // 사용자별(SSOT=DB)
    getUserVoiceId,
    setUserVoiceSetting,
};
