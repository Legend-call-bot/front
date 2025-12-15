// phone_number_list.js

const SERVER_URL = window.location.origin;

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

function cloneSvgById(id) {
    const tpl = document.getElementById(id);
    if (!tpl) return null;

    const svg = tpl.cloneNode(true);
    svg.removeAttribute("id");
    svg.classList.add("pn-icon-svg");
    svg.setAttribute("aria-hidden", "true");
    return svg;
}

function createContactItem(contact) {
    const item = document.createElement("div");
    item.className = "pn-item";

    const displayName = contact.name || "이름 없음";

    item.innerHTML = `
        <div class="pn-item-main">
            <span class="pn-name"></span>
        </div>
        <div class="pn-actions">
            <button class="pn-icon-btn pn-icon-btn--call" type="button" title="전화 걸기"></button>
            <button class="pn-icon-btn pn-icon-btn--star" type="button" title="즐겨찾기 추가"></button>
        </div>
    `;

    item.querySelector(".pn-name").textContent = displayName;

    const callBtn = item.querySelector(".pn-icon-btn--call");
    const starBtn = item.querySelector(".pn-icon-btn--star");

    const callSvg = cloneSvgById("icon-call");
    const starSvg = cloneSvgById("icon-star");

    if (callSvg) callBtn.appendChild(callSvg);
    if (starSvg) starBtn.appendChild(starSvg);

    callBtn.addEventListener("click", () => {
        window.location.href = `call.html`;
    });

    return item;
}

async function loadContacts() {
    const userId = await ensureUserId();

    const res = await fetch(
        `${SERVER_URL}/api/users/${encodeURIComponent(userId)}/contacts`,
        {
            credentials: "include",
        }
    );

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error || "연락처 조회 실패");
    }

    const contacts = data.contacts || [];

    const leftList = document.querySelector(".pn-left .pn-list");
    if (!leftList) return;

    leftList.innerHTML = "";

    contacts.forEach((c) => {
        leftList.appendChild(createContactItem(c));
    });
}

document.addEventListener("DOMContentLoaded", () => {
    loadContacts().catch((e) => {
        console.error(e);
        alert(e.message || "연락처를 불러오지 못했습니다.");
    });

    const addBtn = document.querySelector(".pn-add-btn");
    if (addBtn) {
        addBtn.addEventListener("click", () => {
            window.location.href = "add_number.html";
        });
    }
});
