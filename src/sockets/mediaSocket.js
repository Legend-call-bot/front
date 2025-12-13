// src/sockets/mediaSocket.js
const WebSocket = require("ws");
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const {
    AZURE_SPEECH_KEY,
    AZURE_SPEECH_REGION,
    callHistories,
    callRecommendations,
    genAI,
} = require("../config/env");
const { mulawToPcm16 } = require("../utils/mulaw");
const { summarizeCall } = require("../services/summaryService");

function initMediaSocket(httpServer, io) {
    const wss = new WebSocket.Server({
        noServer: true,
        perMessageDeflate: false,
    });

    const activeStreams = new Map();

    httpServer.on("upgrade", (request, socket, head) => {
        if (request.url.startsWith("/media")) {
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit("connection", ws, request);
            });
        } else {
            socket.destroy();
        }
    });

    wss.on("connection", (ws, req) => {
        const params = new URLSearchParams(req.url.split("?")[1] || "");
        let callSid = params.get("callSid") || null;

        function bindCallSid(newSid) {
            if (!newSid) return;
            if (callSid === newSid && activeStreams.get(newSid) === ws) return;

            // 같은 callSid를 가진 기존 WS가 있으면 끊어준다.
            if (activeStreams.has(newSid)) {
                try {
                    activeStreams.get(newSid).close();
                } catch (e) {
                    // 무시
                }
                activeStreams.delete(newSid);
            }

            // 이전 callSid에 매핑된 게 나 자신이면 제거
            if (callSid && activeStreams.get(callSid) === ws) {
                activeStreams.delete(callSid);
            }

            callSid = newSid;
            activeStreams.set(callSid, ws);
            console.log("Twilio Media WS connected:", callSid);
        }

        if (callSid) {
            bindCallSid(callSid);
        } else {
            console.log("Twilio Media WS connected: (awaiting start)");
        }

        // ===== Azure Speech 초기화 =====
        const speechConfig = sdk.SpeechConfig.fromSubscription(
            AZURE_SPEECH_KEY,
            AZURE_SPEECH_REGION
        );
        speechConfig.speechRecognitionLanguage = "ko-KR";

        const audioFormat = sdk.AudioStreamFormat.getWaveFormatPCM(
            8000,
            16,
            1
        );
        const pushStream = sdk.AudioInputStream.createPushStream(audioFormat);
        const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
        const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

        // ===== 중복 인식 방지 =====
        let lastRecognizedText = "";
        let lastRecognizedTime = 0;

        function isDuplicateRecognition(text) {
            const now = Date.now();
            const tooSoon = now - lastRecognizedTime < 4000;
            const isSame = text === lastRecognizedText;

            if ((isSame && tooSoon) || (text.length <= 3 && tooSoon)) {
                return true;
            }

            lastRecognizedText = text;
            lastRecognizedTime = now;
            return false;
        }

        // ===== STT 결과 핸들러 =====
        recognizer.recognized = async (s, e) => {
            if (
                !e.result ||
                e.result.reason !== sdk.ResultReason.RecognizedSpeech ||
                !e.result.text.trim()
            ) {
                return;
            }

            const text = e.result.text.trim();
            if (isDuplicateRecognition(text)) return;

            console.log("[🎧 최종 인식 결과]", text);

            // 통화별 히스토리 저장
            if (callSid) {
                const history = callHistories.get(callSid) || [];
                history.push({ role: "assistant", content: text });
                callHistories.set(callSid, history);
            }

            // 프론트로 STT 결과 전송
            if (callSid) {
                io.to(callSid).emit("stt.final", { text, callSid });
            }

            // ===== Gemini로 추천 답변 생성 =====
            try {
                const model = genAI.getGenerativeModel({
                    model: "models/gemini-2.0-flash",
                    generationConfig: {
                        temperature: 0.2,
                        maxOutputTokens: 80,
                    },
                });

                const history = callSid ? callHistories.get(callSid) || [] : [];
                const historyText = history
                    .map((m) => `${m.role === "user" ? "나" : "직원"}: ${m.content}`)
                    .join("\n");

                const result = await model.generateContent(`
너는 전화를 건 손님이다.

절대 쓸데없는 질문을 하지 마라.

📌 규칙
1. 직원이 시간/자리/인원 정보를 주면 → 질문 ❌
   → "그럼 6시로 부탁드립니다" 처럼 선택/결정 문장만 생성.
2. 직원이 선택하라고 요청할 때만
   → 선택하는 답변만 추천 생성.
3. 다른 추가 질문 금지.
4. 반드시 3개 추천.
5. 예약 확정 상황에서만
   → "네, 알겠습니다." 사용 가능.

[지금까지 대화]
${historyText}

[직원 발화]
"${text}"

출력 형식:
1. 문장
2. 문장
3. 문장
`);

                let output = result.response.text().trim();

                let replies = output
                    .split("\n")
                    .map((line) => line.replace(/^\d+\.\s*/, "").trim())
                    .filter((v) => v.length > 0);

                // 최소 3개는 보장
                while (replies.length < 3) {
                    replies.push("알겠습니다.");
                }

                // 중복 제거
                replies = [...new Set(replies)];

                // 추천은 히스토리에 저장하지 않고 캐시에만 보관
                if (callSid) {
                    callRecommendations.set(callSid, replies);
                }

                // 프론트로 추천 리스트 전송
                if (callSid) {
                    io.to(callSid).emit("recommendations", {
                        callSid,
                        replies,
                    });
                }
            } catch (err) {
                console.error("[Gemini 오류]", err);
            }
        };

        // ===== WS 메시지 처리 (Twilio Media Stream 이벤트) =====
        ws.on("message", (msg) => {
            try {
                const data = JSON.parse(msg.toString());

                if (data.event === "start") {
                    const sid = data.start?.callSid || data.callSid;
                    if (sid) bindCallSid(sid);

                    console.log("📞 Media stream 시작:", sid);
                } else if (data.event === "media" && data.media?.payload) {
                    const mulaw = Buffer.from(data.media.payload, "base64");
                    const pcm16 = mulawToPcm16(mulaw);
                    pushStream.write(pcm16);
                } else if (data.event === "stop") {
                    console.log(
                        "🛑 Media stream stopped:",
                        callSid || "(unknown)"
                    );
                    pushStream.close();
                    recognizer.stopContinuousRecognitionAsync(() =>
                        recognizer.close()
                    );

                    if (callSid && callHistories.has(callSid)) {
                        summarizeCall(
                            callSid,
                            callHistories.get(callSid),
                            io
                        );
                    }
                }
            } catch (e) {
                console.error("WS parse error:", e);
            }
        });

        // ===== WS 종료 =====
        ws.on("close", () => {
            console.log("🔚 Twilio WS closed:", callSid || "(unknown)");

            if (callSid && activeStreams.get(callSid) === ws) {
                activeStreams.delete(callSid);
            }

            pushStream.close();
            recognizer.stopContinuousRecognitionAsync(() => recognizer.close());
        });

        // ===== STT 시작 =====
        recognizer.startContinuousRecognitionAsync(
            () =>
                console.log(
                    "[STT] Recognition started:",
                    callSid || "(pending)"
                ),
            (err) => console.error("[STT] start error", err)
        );
    });
}

module.exports = initMediaSocket;
