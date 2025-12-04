// add_number.js

document.addEventListener("DOMContentLoaded", () => {
  // 완료 버튼 -> phone_number_list.html 로 이동
  const finishedBtn = document.querySelector(".finished");

  if (finishedBtn) {
    finishedBtn.addEventListener("click", () => {
      // 같은 /pages 폴더 내로 이동
      window.location.href = "phone_number_list.html";
    });
  }
});
