// ⭐ 공통 서버 주소 (ngrok 주소)
const SERVER_URL = window.location.origin;

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
socket.on("call.accepted", ({ callSid }) => {
    console.log("📞 상대방이 전화를 받음:", callSid);

    window.location.href = `../pages/call_live.html?callSid=${callSid}&phone=${encodeURIComponent(
        globalPhone
    )}`;
});

// =============================
//   통화 버튼 클릭 시 실행
// =============================
const callButton = document.querySelector(".call-button");
const phoneInput = document.getElementById("phone");
const intentInput = document.getElementById("intentText");   // ✅ 통화 목적 textarea

callButton.addEventListener("click", async () => {
    let phone = phoneInput.value.trim();
    const intentText = intentInput.value.trim();             // ✅ 하드코딩 대신 입력값 사용

    if (!phone) {
        alert("전화번호를 입력하세요!");
        return;
    }

    if (!intentText) {
        alert("통화 목적을 입력하세요!");
        return;
    }

    // ⭐⭐⭐ 전화번호 보정 ⭐⭐⭐
    phone = phone.replace(/^\+82/, ""); // +82 제거
    phone = phone.replace(/^82/, "");   // 82 제거
    if (!phone.startsWith("0")) phone = "0" + phone;

    globalPhone = phone;

    try {
        const response = await fetch(`${SERVER_URL}/calls`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                phone,
                intentText, // ✅ 사용자가 입력한 내용 그대로 서버로 전달
            }),
        });

        const data = await response.json();
        console.log("📡 발신 완료:", data);

        callButton.innerText = "전화 연결 중...";
        callButton.disabled = true;
    } catch (err) {
        console.error("❌ 전화 발신 실패:", err);
        alert("전화 발신 실패");
    }
});
