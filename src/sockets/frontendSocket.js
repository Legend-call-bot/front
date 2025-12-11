// src/sockets/frontendSocket.js
const { v4: uuidv4 } = require("uuid");
const { PUBLIC_HOST, twilioClient, callVoiceMap } = require("../config/env");
const { synthesizeToFile } = require("../services/ttsService");
const { playToCall } = require("../services/twilioService");
const { resolveVoiceId } = require("../config/voice");

function initFrontendSocket(io) {
    io.on("connection", (socket) => {
        console.log("Frontend socket.io connected:", socket.id);

        socket.on("bind.call", ({ callSid }) => {
            if (!callSid) return;
            socket.data.callSid = callSid;
            socket.join(callSid);
            console.log("📌 bind.call:", callSid, "socket:", socket.id);
        });

        socket.on("replySelected", async ({ text, callSid }) => {
            try {
                const filename = `${uuidv4()}.mp3`;

                const voiceId = resolveVoiceId(null, callVoiceMap.get(callSid));

                await synthesizeToFile(text, filename, voiceId);
                const audioUrl = `${PUBLIC_HOST}/audio/${filename}`;
                await playToCall(callSid, audioUrl);
                console.log("🔊 버튼 TTS 재생:", text);
            } catch (err) {
                console.error("버튼 재생 오류:", err);
            }
        });

        socket.on("say", async ({ text }) => {
            try {
                const callSid = socket.data.callSid;
                if (!callSid) {
                    socket.emit("say.error", { message: "통화 중이 아닙니다." });
                    return;
                }
                const filename = `${uuidv4()}.mp3`;

                const voiceId = resolveVoiceId(null, callVoiceMap.get(callSid));

                await synthesizeToFile(text, filename, voiceId);
                const audioUrl = `${PUBLIC_HOST}/audio/${filename}`;
                await playToCall(callSid, audioUrl);
                socket.emit("say.result", { ok: true });
                console.log("🔊 [say 재생 성공]:", text);
            } catch (err) {
                socket.emit("say.error", { message: err.message });
            }
        });

        socket.on("call.ended.byUser", async ({ callSid }) => {
            console.log("📴 사용자 측 통화 종료 요청:", callSid);
            if (!callSid) {
                console.warn(
                    "callSid가 없어 통화 종료 요청을 처리할 수 없습니다."
                );
                return;
            }

            try {
                await twilioClient
                    .calls(callSid)
                    .update({ status: "completed" });
                console.log("✅ Twilio 통화 강제 종료 완료:", callSid);
                io.to(callSid).emit("call.ended.remote", { callSid });
            } catch (err) {
                console.error("❌ Twilio 통화 종료 실패:", err);
            }
        });
    });
}

module.exports = initFrontendSocket;
