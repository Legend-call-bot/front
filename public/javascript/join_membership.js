// public/javascript/join_membership.js

document.addEventListener("DOMContentLoaded", () => {
  const signupButton = document.querySelector(".login-button");
  if (!signupButton) return;

  signupButton.addEventListener("click", (event) => {
    // 원래 form submit(서버로 /login POST) 막기
    event.preventDefault();

    // 아이디/비번이 비어 있어도 그냥 call.html로 이동
    window.location.href = "call.html"; // join_membership.html과 같은 폴더 기준
  });
});
