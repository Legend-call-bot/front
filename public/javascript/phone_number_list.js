// phone_number_list.js

document.addEventListener("DOMContentLoaded", () => {
  // + 버튼 -> add_number.html 로 이동
  const addBtn = document.querySelector(".pn-add-btn");

  if (addBtn) {
    addBtn.addEventListener("click", () => {
      // phone_number_list.html 과 add_number.html 이 같은 폴더(/pages)에 있을 때
      window.location.href = "add_number.html";
    });
  }
});
