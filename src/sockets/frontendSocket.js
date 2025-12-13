// src/sockets/frontendSocket.js
const { v4: uuidv4 } = require("uuid");
const {
    PUBLIC_HOST,
    twilioClient,
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

        // callSid + userId 바인딩 (SSOT=UserVoiceSetting)
        socket.on("bind.call", ({ callSid, userId }) => {
            if (!callSid) return;

            socket.data.callSid = callSid;
            socket.data.userId = userId || null;

            socket.join(callSid);

            console.log("📌 bind.call:", {
                callSid,
                userId: socket.data.userId,
                socketId: socket.id,
            });
        });

        // 내부 유틸: 바인딩 체크
        function getBoundContextOrWarn(eventName) {
            const callSid = socket.data.callSid;
            const userId = socket.data.userId || null;

            if (!callSid) {
                console.warn(`${eventName}: callSid 미바인딩 소켓`, {
                    socketId: socket.id,
                });
                return null;
            }

            if (!userId) {
                // userId가 없으면 기본 보이스로 fallback 될 수 있음 (ttsService에서 처리)
                console.warn(`${eventName}: userId 없음(기본 보이스 fallback 가능)`, {
                    callSid,
                    socketId: socket.id,
                });
            }

            return { callSid, userId };
        }

        // 추천 버튼 선택
        socket.on("replySelected", async ({ text }) => {
            const ctx = getBoundContextOrWarn("replySelected");
            if (!ctx) return;

            const { callSid, userId } = ctx;

            if (!text) return;

            try {
                const filename = `${uuidv4()}.mp3`;

                console.log("[TTS] replySelected:", {
                    callSid,
                    userId,
                    filename,
                    textPreview: text.slice(0, 30),
                });

                // SSOT 기반: userId로 최신 보이스 조회 (ttsService 내부에서 getUserVoiceId)
                await synthesizeToFile(text, filename, { userId, callSid });

                const audioUrl = `${PUBLIC_HOST}/audio/${filename}`;
                await playToCall(callSid, audioUrl);

                pushPlayedText(callSid, text);
                pushUserHistory(callSid, text);

                console.log("🔊 replySelected 재생 성공:", { callSid, filename });
            } catch (err) {
                console.error("replySelected 재생 오류:", err);
            }
        });

        // 채팅 입력 say
        socket.on("say", async ({ text }) => {
            const ctx = getBoundContextOrWarn("say");
            if (!ctx) {
                socket.emit("say.error", { message: "통화 중이 아닙니다." });
                return;
            }

            const { callSid, userId } = ctx;

            if (!text) {
                socket.emit("say.error", { message: "텍스트가 비어 있습니다." });
                return;
            }

            try {
                const filename = `${uuidv4()}.mp3`;

                console.log("[TTS] say:", {
                    callSid,
                    userId,
                    filename,
                    textPreview: text.slice(0, 30),
                });

                await synthesizeToFile(text, filename, { userId, callSid });

                const audioUrl = `${PUBLIC_HOST}/audio/${filename}`;
                await playToCall(callSid, audioUrl);

                pushPlayedText(callSid, text);
                pushUserHistory(callSid, text);

                socket.emit("say.result", { ok: true });
                console.log("🔊 say 재생 성공:", { callSid, filename });
            } catch (err) {
                socket.emit("say.error", { message: err.message });
            }
        });

        // 통화 종료
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
