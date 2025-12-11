// src/routes/callRoutes.js
const { v4: uuidv4 } = require("uuid");
const {
    twilioClient,
    TWILIO_FROM_NUMBER,
    PUBLIC_HOST,
    callHistories,
    callVoiceMap,
} = require("../config/env");
const { resolveVoiceId } = require("../config/voice");
const { synthesizeToFile } = require("../services/ttsService");

function generateCallScript(intentText) {
    return `안녕하세요. 고객님을 대신해 간단히 문의드립니다. ${intentText}. 가능/불가능만 알려주시면 감사하겠습니다.`;
}

function registerCallRoutes(app, io) {
    // 콜 상태 콜백
    app.post("/call-status", (req, res) => {
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

            // 통화 종료 시 메모리 정리
            callHistories.delete(callSid);
            callVoiceMap.delete(callSid);
        }

        res.sendStatus(200);
    });

    // 발신
    app.post("/calls", async (req, res) => {
        try {
            const { phone, intentText, voice } = req.body;
            if (!phone || !intentText) {
                return res
                    .status(400)
                    .json({ error: "phone and intentText required" });
            }

            let e164Phone = phone.replace(/[^0-9]/g, "");
            if (e164Phone.startsWith("0")) {
                e164Phone = e164Phone.slice(1);
            }
            e164Phone = "+82" + e164Phone;

            console.log("📞 변환된 Twilio 전화번호:", e164Phone);

            const script = generateCallScript(intentText);
            const filename = `${uuidv4()}.mp3`;

            const effectiveVoiceId = resolveVoiceId(voice);

            await synthesizeToFile(script, filename, effectiveVoiceId);
            const audioUrl = `${PUBLIC_HOST}/audio/${filename}`;

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

            callVoiceMap.set(call.sid, effectiveVoiceId);

            res.json({
                callSid: call.sid,
                script,
                audioUrl,
                voiceId: effectiveVoiceId,
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // TTS 프리뷰
    app.post("/tts-preview", async (req, res) => {
        try {
            const { voice } = req.body;

            const voiceId = resolveVoiceId(voice);
            const sampleText = "안녕하세요. 이렇게 들립니다.";
            const filename = `preview-${uuidv4()}.mp3`;

            await synthesizeToFile(sampleText, filename, voiceId);
            const audioUrl = `${PUBLIC_HOST}/audio/${filename}`;

            res.json({ audioUrl, voiceId });
        } catch (err) {
            console.error("TTS preview error:", err);
            res.status(500).json({ error: err.message });
        }
    });
}

module.exports = registerCallRoutes;
