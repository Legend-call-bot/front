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

function formatKoreanPhone(number) {
    number = number.replace(/[^0-9]/g, "");

    if (number.startsWith("0")) number = number.slice(1);

    return `+82 ${number.slice(0, 2)}-${number.slice(2, 6)}-${number.slice(6)}`;
}

if (phone && phoneDisplay) {
    phoneDisplay.textContent = formatKoreanPhone(phone);
}

// ===== 소켓 연결 =====
const SERVER_URL = window.location.origin;

const socket = io(SERVER_URL, {
    transports: ["polling"],
    upgrade: false,
});

// ===== HTML 요소 =====
const chatWindow = document.getElementById("chat-window");
const sendBtn = document.getElementById("send-button");
const inputText = document.getElementById("input-text");
const endCallBtn = document.getElementById("endCallBtn");

// 👉 고정된 "다시 한 번 말씀해 주시겠어요?" 박스
const fixedSuggestion = document.querySelector(".AI-recommended-answer.fixed");
if (fixedSuggestion) {
    fixedSuggestion.addEventListener("click", () => {
        const text = fixedSuggestion.innerText.trim();
        if (!text) return;

        socket.emit("replySelected", {
            text,
            callSid: callSid,
        });

        addMessage("나", text);
    });
}

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

    container.innerHTML = "";

    const filtered = replies.filter(
        (r) => r.trim() !== "다시 한 번 말씀해 주시겠어요?"
    );

    filtered.forEach((r) => {
        const btn = document.createElement("div");
        btn.innerText = r;
        btn.className = "AI-recommended-answer dynamic";

        btn.onclick = () => {
            socket.emit("replySelected", {
                text: r,
                callSid: callSid,
            });

            addMessage("나", r);
        };

        container.appendChild(btn);
    });
});

// ===== 통화 요약 =====
socket.on("call.summary", ({ summary }) => {
    addMessage("📄 통화 요약", summary);
});

// 서버에서 "통화가 끝났다"는 알림이 온 경우 (상대방이 폰에서 끊었을 때 포함)
socket.on("call.ended.remote", ({ callSid: endedSid }) => {
    console.log("📴 서버로부터 통화 종료 알림 수신:", endedSid);

    // 혹시 다른 콜Sid가 섞일 수 있으니 한 번 체크
    if (callSid && endedSid && callSid !== endedSid) {
        console.warn("다른 콜 SID의 종료 이벤트입니다. 무시:", endedSid);
        return;
    }

    // 통화 종료 화면으로 이동
    window.location.href = "finished_call.html";
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
    if (!callSid) {
        alert("콜 정보가 없습니다.");
        return;
    }

    // 중복 클릭 방지
    endCallBtn.disabled = true;

    // 🔴 서버에 통화 종료 요청
    socket.emit("call.ended.byUser", { callSid });

    console.log("통화 종료 요청 전송:", callSid);
});

// ===== 채팅 출력 함수 =====
function addMessage(sender, text) {
    const msg = document.createElement("div");

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
