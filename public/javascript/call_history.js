// public/javascript/call_history.js

document.addEventListener("DOMContentLoaded", () => {
  const row = document.getElementById("reservation-done");
  if (!row) return;

  row.style.cursor = "pointer"; // 손가락 커서 (옵션)

  row.addEventListener("click", () => {
    window.location.href = "call_details.html"; // pages 폴더 기준
  });
});
