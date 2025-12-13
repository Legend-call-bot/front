// src/sockets/frontendSocket.js
const { v4: uuidv4 } = require("uuid");
const {
    PUBLIC_HOST,
    twilioClient,
    callVoiceMap,
    callHistories,
    callPlayedQueue,
} = require("../config/env");
const { synthesizeToFile } = require("../services/ttsService");
const { playToCall } = require("../services/twilioService");

function pushPlayedText(callSid, text) {
    if (!callSid || !text) return;

    const queue = callPlayedQueue.get(callSid) || [];
    queue.push({ text, ts: Date.now() });
    callPlayedQueue.set(callSid, queue.slice(-20));
}

function pushUserHistory(callSid, text) {
    if (!callSid || !text) return;

    const history = callHistories.get(callSid) || [];
    history.push({ role: "user", content: text });
    callHistories.set(callSid, history);
}

function initFrontendSocket(io) {
    io.on("connection", (socket) => {
        console.log("Frontend socket.io connected:", socket.id);

        // callSid + userId 바인딩
        socket.on("bind.call", ({ callSid, userId }) => {
            if (!callSid) return;

            socket.data.callSid = callSid;
            socket.data.userId = userId || null;

            socket.join(callSid);
            console.log(
                "📌 bind.call:",
                callSid,
                "userId:",
                socket.data.userId,
                "socket:",
                socket.id
            );
        });

        // 추천 버튼 선택 → 서버는 바인딩된 callSid만 사용
        socket.on("replySelected", async ({ text }) => {
            try {
                const callSid = socket.data.callSid;
                if (!callSid) {
                    console.warn("replySelected: callSid 미바인딩 소켓:", socket.id);
                    return;
                }

                if (!text) return;

                const filename = `${uuidv4()}.mp3`;

                // 기본: userId 기반으로 DB에서 최신 보이스 조회
                // fallback: callVoiceMap에 값이 있으면 override로 사용(기존 호환)
                const userId = socket.data.userId || null;
                const voiceIdOverride = callVoiceMap.get(callSid) || null;

                await synthesizeToFile(text, filename, { userId, voiceIdOverride });

                const audioUrl = `${PUBLIC_HOST}/audio/${filename}`;
                await playToCall(callSid, audioUrl);

                pushPlayedText(callSid, text);
                pushUserHistory(callSid, text);

                console.log("🔊 버튼 TTS 재생:", text);
            } catch (err) {
                console.error("버튼 재생 오류:", err);
            }
        });

        // say도 동일하게 처리
        socket.on("say", async ({ text }) => {
            try {
                const callSid = socket.data.callSid;
                if (!callSid) {
                    socket.emit("say.error", { message: "통화 중이 아닙니다." });
                    return;
                }

                if (!text) {
                    socket.emit("say.error", { message: "텍스트가 비어 있습니다." });
                    return;
                }

                const filename = `${uuidv4()}.mp3`;

                const userId = socket.data.userId || null;
                const voiceIdOverride = callVoiceMap.get(callSid) || null;

                await synthesizeToFile(text, filename, { userId, voiceIdOverride });

                const audioUrl = `${PUBLIC_HOST}/audio/${filename}`;
                await playToCall(callSid, audioUrl);

                pushPlayedText(callSid, text);
                pushUserHistory(callSid, text);

                socket.emit("say.result", { ok: true });
                console.log("🔊 [say 재생 성공]:", text);
            } catch (err) {
                socket.emit("say.error", { message: err.message });
            }
        });

        socket.on("call.ended.byUser", async ({ callSid }) => {
            console.log("📴 사용자 측 통화 종료 요청:", callSid);
            if (!callSid) {
                console.warn("callSid가 없어 통화 종료 요청을 처리할 수 없습니다.");
                return;
            }

            try {
                await twilioClient.calls(callSid).update({ status: "completed" });
                console.log("✅ Twilio 통화 강제 종료 완료:", callSid);
                io.to(callSid).emit("call.ended.remote", { callSid });
            } catch (err) {
                console.error("❌ Twilio 통화 종료 실패:", err);
            }
        });
    });
}

module.exports = initFrontendSocket;
