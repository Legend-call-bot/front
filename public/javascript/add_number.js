// add_number.js

const SERVER_URL = window.location.origin;

function normalizeKoreanPhone(input) {
    let phone = String(input || "").trim();

    phone = phone.replace(/\s/g, "");
    phone = phone.replace(/-/g, "");

    phone = phone.replace(/^\+82/, "");
    phone = phone.replace(/^82/, "");
    if (phone && !phone.startsWith("0")) {
        phone = "0" + phone;
    }

    return phone;
}

async function ensureUserId() {
    let userId = localStorage.getItem("userId");
    if (userId) return userId;

    const res = await fetch(`${SERVER_URL}/api/users/session`, {
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

document.querySelector(".finished").addEventListener("click", async () => {
    const name = document.getElementById("name").value.trim();
    const phoneRaw = document.getElementById("phone").value.trim();
    const memo = document.getElementById("memo").value.trim();

    const phoneNumber = normalizeKoreanPhone(phoneRaw);

    if (!name) {
        alert("이름을 입력하세요!");
        return;
    }

    if (!phoneNumber) {
        alert("전화번호를 입력하세요!");
        return;
    }

    try {
        const userId = await ensureUserId();

        const res = await fetch(`${SERVER_URL}/api/users/${encodeURIComponent(userId)}/contacts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
                name,
                phoneNumber,
                memo: memo || null,
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || "연락처 저장 실패");
        }

        alert("저장 완료!");
        window.location.href = "phone_number_list.html";
    } catch (err) {
        console.error(err);
        alert(err.message || "연락처 저장 실패");
    }
});

