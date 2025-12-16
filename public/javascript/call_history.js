// public/javascript/call_history.js

async function ensureUserId() {
    // 1) passport 로그인 또는 session userId 둘 다 허용하는 엔드포인트
    const meRes = await fetch(`/api/users/me`, { credentials: "include" });
    if (meRes.ok) {
        const data = await meRes.json();
        const id = data?.user?.id;
        if (id) {
            localStorage.setItem("userId", id);
            return id;
        }
    }

    // 2) 비로그인이면 세션 userId 발급
    const cached = localStorage.getItem("userId");
    if (cached) return cached;

    const res = await fetch(`/api/users/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
    });

    const data = await res.json();
    if (!res.ok || !data.userId) {
        throw new Error(data.error || "userId 발급 실패");
    }

    localStorage.setItem("userId", data.userId);
    return data.userId;
}

async function requireAnyUser() {
    for (let i = 0; i < 3; i++) {
        // 1) passport 또는 session userId로 인증되는 경우
        const meRes = await fetch(`/api/users/me`, { credentials: "include" });
        if (meRes.ok) return;

        // 2) 세션이 없어도 localStorage userId가 있으면 그 유저가 실제 존재하는지 확인
        const cached = localStorage.getItem("userId");
        if (cached) {
            const userRes = await fetch(`/api/users/${encodeURIComponent(cached)}`, {
                credentials: "include",
            });
            if (userRes.ok) return;
        }

        // 3) cached도 없으면 세션 유저 발급 시도
        try {
            await ensureUserId();
        } catch (e) {}

        await new Promise((r) => setTimeout(r, 150));
    }

    window.location.replace("/pages/home.html");
}

document.addEventListener("DOMContentLoaded", async () => {
    await requireAnyUser();

    const row = document.getElementById("reservation-done");
    if (!row) return;

    row.style.cursor = "pointer";
    row.addEventListener("click", () => {
        window.location.href = "call_details.html";
    });
});
