// src/routes/callRoutes.js
const { v4: uuidv4 } = require("uuid");
const prisma = require("../db/prisma");
const {
    twilioClient,
    TWILIO_FROM_NUMBER,
    PUBLIC_HOST,
    callHistories,
} = require("../config/env");
const { getUserVoiceId } = require("../config/voice");
const { synthesizeToFile } = require("../services/ttsService");

function generateCallScript(intentText) {
    return `안녕하세요. 고객님을 대신해 간단히 문의드립니다. ${intentText}. 가능/불가능만 알려주시면 감사하겠습니다.`;
}

function normalizeToE164KR(phone) {
    let digits = String(phone || "").replace(/[^0-9]/g, "");

    if (!digits) {
        throw new Error("phone is required");
    }

    if (digits.startsWith("82")) {
        digits = digits.slice(2);
    }

    if (digits.startsWith("0")) {
        digits = digits.slice(1);
    }

    return `+82${digits}`;
}

function registerCallRoutes(app, io) {
    // 콜 상태 콜백
    app.post("/call-status", async (req, res) => {
        const callSid = req.body.CallSid;
        const callStatus = req.body.CallStatus;

        console.log("📞 Call Status:", callStatus, "SID:", callSid);

        if (callStatus === "in-progress" || callStatus === "answered") {
            console.log("✅ 상대방이 전화를 받았습니다!");
            io.emit("call.accepted", { callSid });
        }

        if (callStatus === "completed") {
            console.log("📴 통화가 종료되었습니다:", callSid);
            io.to(callSid).emit("call.ended.remote", { callSid });

            callHistories.delete(callSid);
        }

        res.sendStatus(200);
    });

    // 발신 (userId(앱 사용자) + contact(상대방))
    app.post("/calls", async (req, res) => {
        try {
            const { userId, phone, intentText, voice, contactName, contactMemo } =
                req.body || {};

            if (!userId || !phone || !intentText) {
                return res.status(400).json({
                    error: "userId, phone, intentText required",
                });
            }

            // 1) 앱 사용자 존재 확인
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { id: true },
            });

            if (!user) {
                return res.status(404).json({ error: "user not found" });
            }

            // 2) 상대방 번호 정규화
            const e164Phone = normalizeToE164KR(phone);
            console.log("📞 변환된 Twilio 전화번호:", e164Phone);

            // 3) Contact upsert (userId + phone 유니크)
            const contact = await prisma.contact.upsert({
                where: {
                    userId_phoneNumber: {
                        userId,
                        phoneNumber: phone,
                    },
                },
                create: {
                    userId,
                    phoneNumber: phone,
                    name: contactName || null,
                    memo: contactMemo || null,
                },
                update: {
                    name: contactName || undefined,
                    memo: contactMemo || undefined,
                },
                select: { id: true },
            });

            // 4) 통화 시작 스크립트 TTS 생성
            // - voice(프론트에서 넘어오는 값)가 있으면 presetKey로 즉시 적용(선택)
            // - 없으면 userId 기반으로 DB에서 최신 보이스 적용
            const script = generateCallScript(intentText);
            const filename = `${uuidv4()}.mp3`;

            await synthesizeToFile(script, filename, {
                userId,
                presetKey: voice || null,
                callSid: null,
            });

            const audioUrl = `${PUBLIC_HOST}/audio/${filename}`;

            // 5) Twilio 발신
            const call = await twilioClient.calls.create({
                url: `${PUBLIC_HOST}/twilio/answer?audioUrl=${encodeURIComponent(
                    audioUrl
                )}`,
                to: e164Phone,
                from: TWILIO_FROM_NUMBER,
                statusCallback: `${PUBLIC_HOST}/call-status`,
                statusCallbackEvent: [
                    "initiated",
                    "ringing",
                    "answered",
                    "completed",
                ],
                statusCallbackMethod: "POST",
            });

            console.log("📞 Call initiated:", call.sid);

            // 6) DB 저장: Call 생성 (앱 사용자 + 상대방)
            // Call.voiceId에는 실제 ElevenLabs voice_id를 저장(추적용)
            const resolvedVoiceId = await getUserVoiceId(userId);

            await prisma.call.create({
                data: {
                    callSid: call.sid,
                    userId: userId,
                    contactId: contact.id,
                    voiceId: resolvedVoiceId,
                },
            });

            return res.json({
                callSid: call.sid,
                script,
                audioUrl,
                voiceId: resolvedVoiceId,
            });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: err.message });
        }
    });

    // TTS 프리뷰 (프리셋 키 기반)
    app.post("/tts-preview", async (req, res) => {
        try {
            const { voice } = req.body || {};

            const sampleText = "안녕하세요. 이렇게 들립니다.";
            const filename = `preview-${uuidv4()}.mp3`;

            await synthesizeToFile(sampleText, filename, {
                presetKey: voice || null,
                userId: null,
                callSid: null,
            });

            const audioUrl = `${PUBLIC_HOST}/audio/${filename}`;
            res.json({ audioUrl });
        } catch (err) {
            console.error("TTS preview error:", err);
            res.status(500).json({ error: err.message });
        }
    });
}

module.exports = registerCallRoutes;
