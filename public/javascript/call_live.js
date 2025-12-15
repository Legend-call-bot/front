// call_live.js

// ===== callSid, phone 가져오기 =====
const params = new URLSearchParams(window.location.search);
const callSid = params.get("callSid");
const phone = params.get("phone");
const userIdFromUrl = params.get("userId");

const SERVER_URL = window.location.origin;

if (!callSid) {
    alert("콜 정보가 없습니다.");
}

// ===== 로그인 유저 우선으로 userId 확정 =====
async function resolveUserId() {
    try {
        const res = await fetch(`${SERVER_URL}/api/me`, {
            credentials: "include",
        });

        if (res.ok) {
            const data = await res.json();
            const id = data && data.user && data.user.id ? data.user.id : null;

            if (id) {
                localStorage.setItem("userId", id);
                return id;
            }
        }
    } catch (e) {
        // ignore
    }

    return userIdFromUrl || localStorage.getItem("userId");
}

// ===== 전화번호 표시 =====
const phoneDisplay = document.querySelector(".phone-number");

function formatKoreanPhone(number) {
    number = (number || "").replace(/[^0-9]/g, "");

    if (number.startsWith("0")) number = number.slice(1);

    if (number.length < 9) return `+82 ${number}`;

    return `+82 ${number.slice(0, 2)}-${number.slice(2, 6)}-${number.slice(6)}`;
}

if (phone && phoneDisplay) {
    phoneDisplay.textContent = formatKoreanPhone(phone);
}

// ===== HTML 요소 =====
const chatWindow = document.getElementById("chat-window");
const sendBtn = document.getElementById("send-button");
const inputText = document.getElementById("input-text");
const endCallBtn = document.getElementById("endCallBtn");

// ===== 상태 변수 =====
let socket = null;
let userId = null;

let hasSummary = false;
let shouldRedirect = false;

// ===== 초기화: userId 확정 후 소켓 연결/바인딩 =====
async function init() {
    userId = await resolveUserId();

    if (!userId) {
        console.warn("⚠️ userId가 없습니다. 기본 보이스로 동작할 수 있습니다.");
    }

    initSocket();
}

function initSocket() {
    socket = io(SERVER_URL, {
        transports: ["polling"],
        upgrade: false,
    });

    socket.on("connect", () => {
        const payload = { callSid };
        if (userId) payload.userId = userId;

        socket.emit("bind.call", payload);
        console.log(
            "✅ callSid 바인딩:",
            callSid,
            "userId:",
            userId || "(none)"
        );
    });

    socket.on("connect_error", (err) => {
        console.error("❌ socket.io 연결 실패:", err);
    });

    // 👉 고정된 "다시 한 번 말씀해 주시겠어요?" 박스
    const fixedSuggestion = document.querySelector(
        ".AI-recommended-answer.fixed"
    );
    if (fixedSuggestion) {
        fixedSuggestion.addEventListener("click", () => {
            const text = fixedSuggestion.innerText.trim();
            if (!text) return;

            socket.emit("replySelected", { text });
            addMessage("나", text);
        });
    }

    // ===== STT 결과 받기 =====
    socket.on("stt.final", ({ text }) => {
        console.log("📥 stt.final 수신:", callSid, text);
        addMessage("직원", text);
    });

    // ===== Gemini 추천 받기 =====
    socket.on("recommendations", ({ replies }) => {
        const container = document.getElementById("dynamic-suggestions");
        if (!container) return;

        container.innerHTML = "";

        const filtered = (replies || []).filter(
            (r) => r && r.trim() !== "다시 한 번 말씀해 주시겠어요?"
        );

        filtered.forEach((r) => {
            const btn = document.createElement("div");
            btn.innerText = r;
            btn.className = "AI-recommended-answer dynamic";

            btn.onclick = () => {
                socket.emit("replySelected", { text: r });
                addMessage("나", r);
            };

            container.appendChild(btn);
        });
    });

    socket.on("call.summary", ({ summary }) => {
        addMessage("📄 통화 요약", summary);
        hasSummary = true;

        try {
            localStorage.setItem("lastCallSummary", summary);
            const phoneText = phoneDisplay ? phoneDisplay.textContent : "";
            if (phoneText) {
                localStorage.setItem("lastCallNumber", phoneText);
            }
        } catch (e) {
            console.warn("통화 요약 로컬 저장 실패:", e);
        }

        if (shouldRedirect) {
            window.location.href = "finished_call.html";
        }
    });

    socket.on("call.ended.remote", ({ callSid: endedSid }) => {
        if (callSid && endedSid && callSid !== endedSid) return;

        if (hasSummary) {
            window.location.href = "finished_call.html";
        } else {
            shouldRedirect = true;

            setTimeout(() => {
                if (!hasSummary) {
                    window.location.href = "finished_call.html";
                }
            }, 3000);
        }
    });
}

// ===== 채팅 입력 전송 =====
function sendChatMessage() {
    const text = inputText ? inputText.value.trim() : "";
    if (!text) return false;

    if (!socket) return false;

    socket.emit("say", { text });
    addMessage("나", text);

    if (inputText) {
        inputText.value = "";
        inputText.blur();
        inputText.focus();
    }
    return true;
}

let isSending = false;

function sendChatMessageOnce() {
    if (isSending) return;

    const sent = sendChatMessage();
    if (!sent) return;

    isSending = true;

    setTimeout(() => {
        isSending = false;
    }, 200);
}

if (sendBtn) {
    sendBtn.addEventListener("click", () => {
        sendChatMessageOnce();
    });
}

let isComposing = false;

if (inputText) {
    inputText.addEventListener("compositionstart", () => {
        isComposing = true;
    });

    inputText.addEventListener("compositionend", () => {
        isComposing = false;
    });

    inputText.addEventListener("keydown", (e) => {
        // 한글 조합 중 Enter는 "확정" 동작이라 전송하면 꼬임
        if (isComposing) return;

        if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            if (e.repeat) return;

            sendChatMessageOnce();
        }
    });
}

// ===== 통화 종료 =====
if (endCallBtn) {
    endCallBtn.addEventListener("click", () => {
        if (!callSid) {
            alert("콜 정보가 없습니다.");
            return;
        }

        endCallBtn.disabled = true;

        if (!socket) return;

        socket.emit("call.ended.byUser", { callSid });

        console.log("통화 종료 요청 전송:", callSid);
    });
}

// ===== 채팅 출력 함수 =====
function addMessage(sender, text) {
    if (!chatWindow) return;

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
    if (!chatWindow) return;
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// ===== 실행 =====
init().catch(console.error);
