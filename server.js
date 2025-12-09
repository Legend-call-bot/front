// server.js
require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const bodyParser = require("body-parser");
const Twilio = require("twilio");
const { createServer } = require("http");
const { Server: IOServer } = require("socket.io");
const WebSocket = require("ws");
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const fsp = require("fs").promises;
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const httpServer = createServer(app);
const io = new IOServer(httpServer);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
// ✅ 수정 후 (정확한 경로)
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/pages/call.html"));
});

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
} = process.env;

if (
  !TWILIO_ACCOUNT_SID ||
  !TWILIO_AUTH_TOKEN ||
  !TWILIO_FROM_NUMBER ||
  !AZURE_SPEECH_KEY ||
  !AZURE_SPEECH_REGION ||
  !PUBLIC_HOST
) {
  console.warn(
    "⚠️ 환경변수 미설정: TWILIO_*, AZURE_SPEECH_*, PUBLIC_HOST 필요."
  );
}

const twilioClient = Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// ✅ 통화별 대화기록 저장소
const callHistories = new Map();

// ---------- 오디오 폴더 ----------
const AUDIO_DIR = path.join(__dirname, "audio");
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR);
async function ensureDir(dir) {
  try {
    await fsp.mkdir(dir, { recursive: true });
  } catch {}
}

// ---------- ElevenLabs TTS ----------
async function synthesizeToFile(text, filename) {
  if (!ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) {
    throw new Error(
      "ELEVENLABS_API_KEY 또는 ELEVENLABS_VOICE_ID가 설정되지 않았습니다."
    );
  }

  // audio 디렉토리 없으면 생성
  await fsp.mkdir(AUDIO_DIR, { recursive: true });
  const audioFile = path.join(AUDIO_DIR, filename);

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: text || "",
      model_id: ELEVENLABS_MODEL_ID, // 내 보이스에 맞는 모델
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[ElevenLabs TTS error]", res.status, body);
    throw new Error(`ElevenLabs TTS 실패: HTTP ${res.status}`);
  }

  const arrayBuf = await res.arrayBuffer();
  await fsp.writeFile(audioFile, Buffer.from(arrayBuf));
  console.log("[TTS 완료 - ElevenLabs]", audioFile);

  // Azure 버전과 동일하게, 생성된 파일 경로 리턴
  return audioFile;
}


// ---------- Twilio 재생 ----------
async function playToCall(callSid, audioUrl) {
  const base = PUBLIC_HOST;
  const wsBase = base.startsWith("https")
    ? base.replace(/^https/, "wss")
    : base.replace(/^http/, "ws");
  const wsUrl = `${wsBase}/media?callSid=${encodeURIComponent(callSid)}`;
  const twiml = [
    "<Response>",
    `<Start><Stream url=\"${wsUrl}\"/></Start>`,
    `<Play>${audioUrl}</Play>`,
    `<Pause length=\"1\"/>`,
    `<Redirect method=\"POST\">${base}/twilio/hold</Redirect>`,
    "</Response>",
  ].join("");
  console.log("📨 Twilio update callSid:", callSid);
  return twilioClient.calls(callSid).update({ twiml });
}

app.post(
  "/call-status",
  bodyParser.urlencoded({ extended: false }),
  (req, res) => {
    const callSid = req.body.CallSid;
    const callStatus = req.body.CallStatus;

    console.log("📞 Call Status:", callStatus, "SID:", callSid);

    if (callStatus === "in-progress" || callStatus === "answered") {
      console.log("✅ 상대방이 전화를 받았습니다!");
      io.emit("call.accepted", { callSid });
    }

    res.sendStatus(200);
  }
);

// ---------- 발신 ----------
function generateCallScript(intentText) {
  return `안녕하세요. 고객님을 대신해 간단히 문의드립니다. ${intentText}. 가능/불가능만 알려주시면 감사하겠습니다.`;
}
app.post("/calls", async (req, res) => {
  try {
    const { phone, intentText } = req.body;
    if (!phone || !intentText)
      return res.status(400).json({ error: "phone and intentText required" });

    // ⭐ Twilio용 E.164 형식으로 전화번호 변환
    let e164Phone = phone.replace(/[^0-9]/g, ""); // 숫자만 추출
    if (e164Phone.startsWith("0")) {
      e164Phone = e164Phone.slice(1); // 010 → 10
    }
    e164Phone = "+82" + e164Phone; // 최종: +821052781839

    console.log("📞 변환된 Twilio 전화번호:", e164Phone);

    const script = generateCallScript(intentText);
    const filename = `${uuidv4()}.mp3`;
    await synthesizeToFile(script, filename);
    const audioUrl = `${PUBLIC_HOST}/audio/${filename}`;

    const call = await twilioClient.calls.create({
      url: `${PUBLIC_HOST}/twilio/answer?audioUrl=${encodeURIComponent(
        audioUrl
      )}`,
      to: e164Phone, // ⭐ 여기 phone → e164Phone 교체됨
      from: TWILIO_FROM_NUMBER,

      statusCallback: `${PUBLIC_HOST}/call-status`,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      statusCallbackMethod: "POST",
    });

    console.log("📞 Call initiated:", call.sid);
    res.json({ callSid: call.sid, script, audioUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- TwiML ----------
app.all("/twilio/answer", (req, res) => {
  const audioUrl = req.query.audioUrl;
  const callSid = req.body?.CallSid || req.query?.CallSid || "unknown";
  const wsBase = PUBLIC_HOST.startsWith("https")
    ? PUBLIC_HOST.replace(/^https/, "wss")
    : PUBLIC_HOST.replace(/^http/, "ws");
  const wsUrl = `${wsBase}/media?callSid=${encodeURIComponent(callSid)}`;

  const twiml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Response>",
    `<Start><Stream url=\"${wsUrl}\"/></Start>`,
    `<Play>${audioUrl}</Play>`,
    '<Pause length="60"/>',
    `<Redirect method=\"POST\">${PUBLIC_HOST}/twilio/hold</Redirect>`,
    "</Response>",
  ];
  res.type("text/xml").send(twiml.join("\n"));
});

app.all("/twilio/hold", (req, res) => {
  const callSid = req.body?.CallSid || req.query?.CallSid || "unknown";
  const wsUrl = `${PUBLIC_HOST.replace(
    /^http/,
    "ws"
  )}/media?callSid=${encodeURIComponent(callSid)}`;
  const twiml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Response>",
    `<Start><Stream url=\"${wsUrl}\"/></Start>`,
    '<Pause length="60"/>',
    `<Redirect method=\"POST\">${PUBLIC_HOST}/twilio/hold</Redirect>`,
    "</Response>",
  ];
  res.type("text/xml").send(twiml.join("\n"));
});

app.use("/audio", express.static(AUDIO_DIR));

// ---------- μ-law → PCM16 ----------
function mulawToPcm16(mulawBuffer) {
  const out = Buffer.alloc(mulawBuffer.length * 2);
  for (let i = 0; i < mulawBuffer.length; i++) {
    let mu = ~mulawBuffer[i] & 0xff;
    const sign = mu & 0x80 ? -1 : 1;
    const exponent = (mu >> 4) & 0x07;
    const mantissa = mu & 0x0f;
    let sample = ((mantissa << 3) + 0x84) << exponent;
    sample = sign * sample;
    out.writeInt16LE(sample, i * 2);
  }
  return out;
}

// ---------- 통화 요약 함수 (새로 추가) ----------
async function summarizeCall(callSid, history) {
  try {
    const model = genAI.getGenerativeModel({
      model: "models/gemini-2.0-flash",
    });

    const transcript = history
      .map((m) => `${m.role === "user" ? "손님" : "직원"}: ${m.content}`)
      .join("\n");

    const prompt = `
다음은 손님과 직원 간의 전화 대화 기록입니다.

대화 내용을 **3줄 이내**로 간단히 요약하세요.
중요 정보(예약 시간, 날짜, 인원, 요청사항 등)가 있다면 포함하세요.
불필요한 말투 제거하고 사실만 정리하세요.

대화 기록:
${transcript}
`;

    const result = await model.generateContent(prompt);
    const summary = result.response.text().trim();

    console.log("📄 통화 요약 생성 완료:\n", summary);

    // ✅ 프론트로 전송
    if (callSid) {
      io.to(callSid).emit("call.summary", { callSid, summary });
    }
  } catch (err) {
    console.error("요약 생성 오류:", err);
  }
}

// ---------- STT + 대화기억형 Gemini ----------
const wss = new WebSocket.Server({ noServer: true, perMessageDeflate: false });
const activeStreams = new Map();

httpServer.on("upgrade", (request, socket, head) => {
  if (request.url.startsWith("/media")) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else socket.destroy();
});

wss.on("connection", (ws, req) => {
  const params = new URLSearchParams(req.url.split("?")[1] || "");
  let callSid = params.get("callSid") || null;

  function bindCallSid(newSid) {
    if (!newSid) return;
    if (callSid === newSid && activeStreams.get(newSid) === ws) return;

    if (activeStreams.has(newSid)) {
      try {
        activeStreams.get(newSid).close();
      } catch {}
      activeStreams.delete(newSid);
    }
    if (callSid && activeStreams.get(callSid) === ws) {
      activeStreams.delete(callSid);
    }
    callSid = newSid;
    activeStreams.set(callSid, ws);
    console.log("Twilio Media WS connected:", callSid);
  }

  if (callSid) bindCallSid(callSid);
  else console.log("Twilio Media WS connected: (awaiting start)");

  const speechConfig = sdk.SpeechConfig.fromSubscription(
    AZURE_SPEECH_KEY,
    AZURE_SPEECH_REGION
  );
  speechConfig.speechRecognitionLanguage = "ko-KR";
  const audioFormat = sdk.AudioStreamFormat.getWaveFormatPCM(8000, 16, 1);
  const pushStream = sdk.AudioInputStream.createPushStream(audioFormat);
  const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
  const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

  let lastRecognizedText = "";
  let lastRecognizedTime = 0;
  let conversationHistory = [];

  function isDuplicateRecognition(text) {
    const now = Date.now();
    const tooSoon = now - lastRecognizedTime < 4000;
    const isSame = text === lastRecognizedText;
    if ((isSame && tooSoon) || (text.length <= 3 && tooSoon)) return true;
    lastRecognizedText = text;
    lastRecognizedTime = now;
    return false;
  }

  recognizer.recognized = async (s, e) => {
    if (
      !e.result ||
      e.result.reason !== sdk.ResultReason.RecognizedSpeech ||
      !e.result.text.trim()
    )
      return;

    const text = e.result.text.trim();
    if (isDuplicateRecognition(text)) return;

    console.log("[🎧 최종 인식 결과]", text);
    conversationHistory.push({ role: "user", content: text });

    // ✅ 전역 callHistory 저장 (요약용)
    if (callSid) {
      const history = callHistories.get(callSid) || [];
      history.push({ role: "user", content: text });
      callHistories.set(callSid, history);
    }

    if (callSid) {
      io.to(callSid).emit("stt.final", { text, callSid }); // ✅ 해당 통화 방으로만
    }

    try {
      const model = genAI.getGenerativeModel({
        model: "models/gemini-2.0-flash",
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 80, // ✅ 이거 추가
        },
      });

      const historyText = conversationHistory
        .map((m) => `${m.role === "user" ? "사용자" : "AI"}: ${m.content}`)
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

      // 줄별로 나누기
      let replies = output
        .split("\n")
        .map((line) => line.replace(/^\d+\.\s*/, "").trim())
        .filter((v) => v.length > 0);

      // 3개 안 나오면 강제로 채우기
      while (replies.length < 3) {
        replies.push("알겠습니다.");
      }


      // 중복 제거
      replies = [...new Set(replies)];

      // 대화 저장
      conversationHistory.push({
        role: "assistant",
        content: replies.join(" | "),
      });

      // 전역 히스토리에도 저장
      if (callSid) {
        const history = callHistories.get(callSid) || [];
        history.push({
          role: "assistant",
          content: replies.join(" | "),
        });
        callHistories.set(callSid, history);
      }

      // ✅ 3개 추천을 그대로 프론트로 보내기
      if (callSid) {
        io.to(callSid).emit("recommendations", { callSid, replies }); // ✅ 해당 통화 방으로만
      }
    } catch (err) {
      console.error("[Gemini 오류]", err);
    }
  };

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.event === "start") {
        const sid = data.start?.callSid || data.callSid;
        if (sid) bindCallSid(sid);

        console.log("📞 Media stream 시작:", sid);
        // io.emit("call.connected", { callSid: sid });  // 🔴 이건 잠깐 주석
      } else if (data.event === "media" && data.media?.payload) {
        const mulaw = Buffer.from(data.media.payload, "base64");
        const pcm16 = mulawToPcm16(mulaw);
        pushStream.write(pcm16);
      } else if (data.event === "stop") {
        console.log("🛑 Media stream stopped:", callSid || "(unknown)");
        pushStream.close();
        recognizer.stopContinuousRecognitionAsync(() => recognizer.close());

        // ✅ 통화 종료 → 요약 실행
        if (callSid && callHistories.has(callSid)) {
          summarizeCall(callSid, callHistories.get(callSid));
        }
      }
    } catch (e) {
      console.error("WS parse error:", e);
    }
  });

  ws.on("close", () => {
    console.log("🔚 Twilio WS closed:", callSid || "(unknown)");
    if (callSid && activeStreams.get(callSid) === ws) {
      activeStreams.delete(callSid);
    }
    pushStream.close();
    recognizer.stopContinuousRecognitionAsync(() => recognizer.close());
  });

  recognizer.startContinuousRecognitionAsync(
    () => console.log("[STT] Recognition started:", callSid || "(pending)"),
    (err) => console.error("[STT] start error", err)
  );
});

// ---------- 프론트 소켓 ----------
io.on("connection", (socket) => {
  console.log("Frontend socket.io connected:", socket.id);

  socket.on("bind.call", ({ callSid }) => {
    if (!callSid) return;
    socket.data.callSid = callSid;
    socket.join(callSid); // ✅ callSid 방 참여
    console.log("📌 bind.call:", callSid, "socket:", socket.id);

    // 👉 이미 인식된 대화가 있으면 처음 로딩할 때 한번 쏴주고 싶으면 여기서 history도 보낼 수 있음
    // const history = callHistories.get(callSid) || [];
    // ...
  });

  socket.on("replySelected", async ({ text, callSid }) => {
    try {
      const filename = `${uuidv4()}.mp3`;
      await synthesizeToFile(text, filename);
      const audioUrl = `${PUBLIC_HOST}/audio/${filename}`;
      await playToCall(callSid, audioUrl);
      console.log("🔊 버튼 TTS 재생:", text);
    } catch (err) {
      console.error("버튼 재생 오류:", err);
    }
  });

  socket.on("say", async ({ text }) => {
    try {
      const callSid = socket.data.callSid; // ✅ 이 소켓에 묶인 통화 사용
      if (!callSid) {
        socket.emit("say.error", { message: "통화 중이 아닙니다." });
        return;
      }
      const filename = `${uuidv4()}.mp3`;
      await synthesizeToFile(text, filename);
      const audioUrl = `${PUBLIC_HOST}/audio/${filename}`;
      await playToCall(callSid, audioUrl);
      socket.emit("say.result", { ok: true });
      console.log("🔊 [say 재생 성공]:", text);
    } catch (err) {
      socket.emit("say.error", { message: err.message });
    }
  });
});

app.get("/health", (req, res) => res.json({ ok: true }));

httpServer.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`PUBLIC_HOST=${PUBLIC_HOST}`);
});

io.on("connection", (socket) => {
  socket.on("call.ended.byUser", ({ callSid }) => {
    console.log("📴 사용자 측 통화 종료 요청:", callSid);

    // 여기서 나중에 Twilio 강제 종료도 가능
    // twilioClient.calls(callSid).update({ status: "completed" });
  });
});