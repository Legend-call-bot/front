// call_live.js
// ===== callSid 가져오기 =====
const params = new URLSearchParams(window.location.search);
const callSid = params.get("callSid");
const phone = params.get("phone");

if (!callSid) {
  alert("콜 정보가 없습니다.");
}

// ===== 전화번호 표시 =====
const phoneDisplay = document.querySelector(".phone-number");

// 한국 전화번호 포맷팅(+82 변환)
function formatKoreanPhone(number) {
  number = number.replace(/[^0-9]/g, ""); // 숫자만 추출

  // 01012341234 → 10-1234-1234 로 변환
  if (number.startsWith("0")) number = number.slice(1); // 010 → 10

  // number = "10XXXXXXXX"
  return `+82 ${number.slice(0, 2)}-${number.slice(2, 6)}-${number.slice(6)}`;
}

if (phone && phoneDisplay) {
  phoneDisplay.textContent = formatKoreanPhone(phone);
}
// ===== 소켓 연결 =====
const SERVER_URL = "https://unvolcanic-howard-unshapable.ngrok-free.dev";

const socket = io(SERVER_URL, {
  transports: ["polling"],
  upgrade: false,
});

// ===== HTML 요소 =====
const chatWindow = document.getElementById("chat-window");
const sendBtn = document.getElementById("send-button");
const inputText = document.getElementById("input-text");

// ★★★ endCallBtn은 한 번만 선언해야 함 ★★★
const endCallBtn = document.getElementById("endCallBtn");

// ===== 통화 bind =====
socket.emit("bind.call", { callSid });
console.log("✅ callSid 바인딩:", callSid);

// ===== STT 결과 받기 =====
socket.on("stt.final", ({ text }) => {
  console.log("📥 stt.final 수신:", callSid, text);
  addMessage("직원", text);
});

// ===== Gemini 추천 받기 =====
socket.on("recommendations", ({ replies }) => {
  const container = document.getElementById("dynamic-suggestions");

  // 기존 추천 모두 삭제
  container.innerHTML = "";

  replies.forEach((r) => {
    const btn = document.createElement("div");
    btn.innerText = r;
    btn.className = "AI-recommended-answer dynamic";

    btn.onclick = () => {
      socket.emit("replySelected", {
        text: r,
        callSid: callSid,
      });

      addMessage("나", r);  // 내가 보낸 메시지 → 오른쪽 정렬됨
    };

    container.appendChild(btn);
  });
});

// 추천답변 내용 바뀔 때마다 이 함수 한번씩 호출해주면 됨
// 예: 버튼을 새로 렌더링한 뒤
// updateFixedPosition();


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

  // 직원(STT) = 왼쪽, 나(TTS) = 오른쪽
  if (sender === "직원") {
    msg.className = "chat-message left";
  } else {
    msg.className = "chat-message right";
  }

  msg.innerHTML = `<b>${sender}:</b> ${text}`;
  chatWindow.appendChild(msg);

  scrollToBottom();
}


function scrollToBottom() {
  chatWindow.scrollTop = chatWindow.scrollHeight;
}