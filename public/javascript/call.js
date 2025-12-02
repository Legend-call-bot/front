// ⭐ 공통 서버 주소 (ngrok 주소)
const SERVER_URL = "https://glancingly-gorsy-zana.ngrok-free.dev";

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

callButton.addEventListener("click", async () => {
  let phone = phoneInput.value.trim(); // ⭐ let 로 변경해야 함
  const intentText = "전화 연결 테스트";

  if (!phone) {
    alert("전화번호를 입력하세요!");
    return;
  }

  // ⭐⭐⭐ 여기 3줄만 추가하면 전화번호 문제 해결 ⭐⭐⭐
  phone = phone.replace(/^\+82/, ""); // +82 제거
  phone = phone.replace(/^82/, ""); // 82 제거
  if (!phone.startsWith("0")) phone = "0" + phone; // 1052781839 → 01052781839 보정

  globalPhone = phone; // ⭐⭐ 꼭 필요!

  try {
    const response = await fetch(`${SERVER_URL}/calls`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone,
        intentText,
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
