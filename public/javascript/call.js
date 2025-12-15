// call.js

// ⭐ 공통 서버 주소 (ngrok 주소)
const SERVER_URL = window.location.origin;

async function getLoggedInUserId() {
    try {
        const res = await fetch(`${SERVER_URL}/api/me`, {
            credentials: "include",
        });
        if (!res.ok) return null;

        const data = await res.json();
        return data && data.user && data.user.id ? data.user.id : null;
    } catch (e) {
        return null;
    }
}

async function ensureUserId() {
    // 1) 구글 로그인 유저면 그 id를 최우선으로 사용
    const loggedInUserId = await getLoggedInUserId();
    if (loggedInUserId) {
        localStorage.setItem("userId", loggedInUserId);
        return loggedInUserId;
    }

    // 2) 비로그인이면 기존 세션 userId 사용/발급
    let userId = localStorage.getItem("userId");
    if (userId) return userId;

    const res = await fetch(`${SERVER_URL}/api/users/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
    });

    const data = await res.json();

    if (!res.ok || !data.userId) {
        throw new Error(data.error || "userId 발급 실패");
    }

    localStorage.setItem("userId", data.userId);
    return data.userId;
}

// ⭐ 저장용 전역 변수
let globalPhone = null;

// ⭐ ngrok에서는 websocket 금지 → polling만 사용
const socket = io(SERVER_URL, {
    transports: ["polling"],
    upgrade: false,
});

socket.on("connect", () => {
    console.log("✅ socket.io 연결 성공");
});

socket.on("connect_error", (err) => {
    console.error("❌ socket.io 연결 실패:", err);
});

// ⭐ 상대방이 전화를 받으면 call_live로 이동
socket.on("call.accepted", async ({ callSid }) => {
    console.log("📞 상대방이 전화를 받음:", callSid);

    const userId = await ensureUserId();

    const phoneParam = globalPhone ? encodeURIComponent(globalPhone) : "";

    window.location.href =
        `../pages/call_live.html?callSid=${encodeURIComponent(callSid)}` +
        `&phone=${phoneParam}` +
        `&userId=${encodeURIComponent(userId)}`;
});

// =============================
//   통화 버튼 클릭 시 실행
// =============================
const callButton = document.querySelector(".call-button");
const phoneInput = document.getElementById("phone");
const intentInput = document.getElementById("intentText");

callButton.addEventListener("click", async () => {
    let phone = phoneInput.value.trim();
    const intentText = intentInput.value.trim();

    if (!phone) {
        alert("전화번호를 입력하세요!");
        return;
    }

    if (!intentText) {
        alert("통화 목적을 입력하세요!");
        return;
    }

    phone = phone.replace(/^\+82/, "");
    phone = phone.replace(/^82/, "");
    if (!phone.startsWith("0")) phone = "0" + phone;

    globalPhone = phone;

    try {
        const userId = await ensureUserId();

        const response = await fetch(`${SERVER_URL}/calls`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                userId,
                phone,
                intentText,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "전화 발신 실패");
        }

        console.log("📡 발신 완료:", data);

        callButton.innerText = "전화 연결 중...";
        callButton.disabled = true;
    } catch (err) {
        console.error("❌ 전화 발신 실패:", err);
        alert(err.message || "전화 발신 실패");
    }
});

window.addEventListener("DOMContentLoaded", () => {
    ensureUserId().catch(console.error);
});

async function requireLogin() {
    const res = await fetch("/api/me", { credentials: "include" });
    if (!res.ok) {
        window.location.replace("/pages/home.html");
    }
}

requireLogin();
