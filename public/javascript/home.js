// public/javascript/home.js

(function () {
    const GOOGLE_LOGIN_URL = "/auth/google";

    async function isAuthenticated() {
        try {
            const res = await fetch("/api/me", {
                credentials: "include",
            });
            return res.ok;
        } catch (e) {
            return false;
        }
    }

    function bindGoogleLoginButton() {
        const btn = document.getElementById("googleLoginBtn");
        if (!btn) return;

        btn.addEventListener("click", () => {
            window.location.href = GOOGLE_LOGIN_URL;
        });
    }

    document.addEventListener("DOMContentLoaded", async () => {
        bindGoogleLoginButton();

        const ok = await isAuthenticated();
        if (ok) {
            window.location.replace("call.html");
        }
    });
})();
