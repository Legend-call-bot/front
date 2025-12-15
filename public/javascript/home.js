// public/javascript/home.js
async function redirectIfLoggedIn() {
    try {
        const res = await fetch("/api/me", { credentials: "include" });

        if (res.ok) {
            window.location.replace("/pages/call.html");
            return;
        }
    } catch (e) {
        // 네트워크 에러면 그냥 홈 유지
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("googleLoginBtn");
    if (btn) {
        btn.addEventListener("click", () => {
            window.location.href = "/auth/google";
        });
    }

    redirectIfLoggedIn();
});
