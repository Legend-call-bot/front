// ===== callSid 가져오기 =====
const params = new URLSearchParams(window.location.search);
const callSid = params.get("callSid");

if (!callSid) {
  alert("콜 정보가 없습니다.");
}

// ===== 소켓 연결 =====
const socket = io("http://localhost:3003");

// ===== HTML 요소 =====
const chatWindow = document.getElementById("chat-window");
const sendBtn = document.getElementById("send-button");
const inputText = document.getElementById("input-text");
const endCallBtn = document.querySelector(".end-call");

// ===== 통화 bind =====
socket.emit("bind.call", { callSid });
console.log("✅ callSid 바인딩:", callSid);

// ===== STT 결과 받기 =====
socket.on("stt.final", ({ text }) => {
  addMessage("직원", text);
});

// ===== Gemini 추천 받기 =====
socket.on("recommendations", ({ replies }) => {
  replies.forEach((r) => {
    const btn = document.createElement("button");
    btn.innerText = r;
    btn.className = "recommend-btn";

    btn.onclick = () => {
      socket.emit("replySelected", {
        text: r,
        callSid: callSid,
      });

      addMessage("AI 추천", r);
    };

    chatWindow.appendChild(btn);
    scrollToBottom();
  });
});

// ===== 통화 요약 =====
socket.on("call.summary", ({ summary }) => {
  addMessage("📄 통화 요약", summary);
});

// ===== 채팅 입력 전송 =====
sendBtn.addEventListener("click", () => {
  const text = inputText.value.trim();
  if (!text) return;

  socket.emit("say", { text });
  addMessage("나", text);
  inputText.value = "";
});

// ===== 통화 종료 =====
endCallBtn.addEventListener("click", () => {
  alert("통화를 종료합니다.");
  window.location.href = "call.html";
});

// ===== 채팅 출력 함수 =====
function addMessage(sender, text) {
  const msg = document.createElement("div");
  msg.className = "chat-message";

  msg.innerHTML = `<b>${sender}:</b> ${text}`;
  chatWindow.appendChild(msg);

  scrollToBottom();
}

function scrollToBottom() {
  chatWindow.scrollTop = chatWindow.scrollHeight;
}
