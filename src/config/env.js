// src/config/env.js
const Twilio = require("twilio");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const {
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_FROM_NUMBER,
    AZURE_SPEECH_KEY,
    AZURE_SPEECH_REGION,
    ELEVENLABS_API_KEY,
    ELEVENLABS_VOICE_ID,
    ELEVENLABS_MODEL_ID,
    GEMINI_API_KEY,
    PORT = 3003,
    PUBLIC_HOST,
    ELEVENLABS_VOICE_ID_BRIGHT,
    ELEVENLABS_VOICE_ID_CLEAR,
    ELEVENLABS_VOICE_ID_CALM,
    ELEVENLABS_VOICE_ID_WARM,
} = process.env;

// 필수 환경변수 체크
const requiredEnv = {
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_FROM_NUMBER,
    AZURE_SPEECH_KEY,
    AZURE_SPEECH_REGION,
    PUBLIC_HOST,
    ELEVENLABS_API_KEY,
    ELEVENLABS_MODEL_ID,
    ELEVENLABS_VOICE_ID_BRIGHT,
    ELEVENLABS_VOICE_ID_CLEAR,
    ELEVENLABS_VOICE_ID_CALM,
    ELEVENLABS_VOICE_ID_WARM,
    GEMINI_API_KEY,
};

const missingEnvKeys = Object.entries(requiredEnv)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

if (missingEnvKeys.length > 0) {
    console.warn("⚠️ 다음 환경변수가 설정되지 않았습니다:");
    console.warn("   " + missingEnvKeys.join(", "));
}

const twilioClient = Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// 통화별 저장소
const callHistories = new Map();
const callVoiceMap = new Map();

// 추천 캐시, 실제 송출 문장 큐
const callRecommendations = new Map();
const callPlayedQueue = new Map();

module.exports = {
    // env
    TWILIO_FROM_NUMBER,
    AZURE_SPEECH_KEY,
    AZURE_SPEECH_REGION,
    ELEVENLABS_API_KEY,
    ELEVENLABS_VOICE_ID,
    ELEVENLABS_MODEL_ID,
    PUBLIC_HOST,
    PORT,

    // 외부 클라이언트
    twilioClient,
    genAI,

    // 공용 상태
    callHistories,
    callVoiceMap,
    callRecommendations,
    callPlayedQueue,

    // 프리셋용 보이스 ID
    ELEVENLABS_VOICE_ID_BRIGHT,
    ELEVENLABS_VOICE_ID_CLEAR,
    ELEVENLABS_VOICE_ID_CALM,
    ELEVENLABS_VOICE_ID_WARM,
};
