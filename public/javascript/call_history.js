// public/javascript/call_history.js

async function fetchMe() {
    // 프로젝트에 따라 /api/me 또는 /api/users/me 를 쓰는 경우가 있어서 둘 다 시도
    const endpoints = ["/api/me", "/api/users/me"];

    for (const url of endpoints) {
        try {
            const res = await fetch(url, { credentials: "include" });
            if (!res.ok) continue;

            const data = await res.json();
            const id = data?.user?.id;
            if (id) {
                return { id, data };
            }
        } catch (e) {
            // ignore
        }
    }

    return null;
}

async function ensureUserId() {
    const me = await fetchMe();
    if (me?.id) {
        localStorage.setItem("userId", me.id);
        return me.id;
    }

    const cached = localStorage.getItem("userId");
    if (cached) return cached;

    const res = await fetch(`/api/users/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.userId) {
        throw new Error(data.error || "userId 발급 실패");
    }

    localStorage.setItem("userId", data.userId);
    return data.userId;
}

async function requireAnyUser() {
    for (let i = 0; i < 3; i++) {
        const me = await fetchMe();
        if (me?.id) return;

        const cached = localStorage.getItem("userId");
        if (cached) {
            try {
                const userRes = await fetch(
                    `/api/users/${encodeURIComponent(cached)}`,
                    { credentials: "include" }
                );
                if (userRes.ok) return;
            } catch (e) {
                // ignore
            }
        }

        try {
            await ensureUserId();
        } catch (e) {
            // ignore
        }

        await new Promise((r) => setTimeout(r, 150));
    }

    window.location.replace("/pages/home.html");
}

function pad2(n) {
    return String(n).padStart(2, "0");
}

function formatTime(date) {
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatSectionTitle(date) {
    const now = new Date();

    const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );
    const startOfThatDay = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    );

    const diffDays = Math.floor(
        (startOfToday - startOfThatDay) / (24 * 60 * 60 * 1000)
    );

    if (diffDays === 0) return "오늘";
    if (diffDays === 1) return "어제";

    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    return `${date.getMonth() + 1}월 ${date.getDate()}일 ${
        weekdays[date.getDay()]
    }`;
}

function dateKey(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
        date.getDate()
    )}`;
}

// 지금은 앱이 “발신”만 하니까 outgoing으로 고정 (추후 status 컬럼 생기면 분기)
function buildCallIconHtml() {
    return `
        <div class="ch-ic ch-ic--outgoing" aria-hidden="true">
            <svg class="ch-ic-icon" width="24" height="24" viewBox="0 0 24 24" fill="none"
                xmlns="http://www.w3.org/2000/svg">
                <path
                    d="M18.3548 2.33301L22.2467 6.22487M22.2467 6.22487L18.8094 9.66567M22.2467 6.22487L13.4035 6.22487M19.7899 19.4057C19.7899 19.4057 18.598 20.5764 18.3059 20.9196C17.83 21.4274 17.2694 21.6672 16.5345 21.6672C16.4638 21.6672 16.3884 21.6672 16.3177 21.6625C14.9185 21.5731 13.6182 21.0277 12.643 20.5623C9.97643 19.274 7.63495 17.4451 5.68922 15.1272C4.08269 13.1949 3.00853 11.4083 2.29713 9.49002C1.85899 8.31932 1.69881 7.40721 1.76948 6.54682C1.81659 5.99673 2.0286 5.54068 2.41963 5.15045L4.02615 3.5472C4.257 3.33093 4.50199 3.21339 4.74226 3.21339C5.03907 3.21339 5.27934 3.39205 5.4301 3.5425C5.43481 3.5472 5.43952 3.5519 5.44423 3.55661C5.73162 3.8246 6.00487 4.10199 6.29225 4.39819C6.4383 4.54864 6.58906 4.69909 6.73982 4.85425L8.02598 6.13778C8.52537 6.63615 8.52537 7.09691 8.02598 7.59528C7.88936 7.73162 7.75744 7.86797 7.62082 7.99961C7.22507 8.40395 7.53595 8.09371 7.12608 8.46043C7.11665 8.46983 7.10723 8.47454 7.10252 8.48394C6.69735 8.88828 6.77273 9.28321 6.85754 9.5512C6.86225 9.56531 6.86696 9.57941 6.87167 9.59352C7.20617 10.4022 7.67729 11.1638 8.39339 12.0713L8.39811 12.076C9.6984 13.6745 11.0694 14.9204 12.5817 15.8748C12.7748 15.9971 12.9727 16.0958 13.1612 16.1899C13.3308 16.2745 13.4909 16.3544 13.6276 16.439C13.6464 16.4484 13.6653 16.4625 13.6841 16.472C13.8443 16.5519 13.995 16.5895 14.1505 16.5895C14.5415 16.5895 14.7865 16.345 14.8666 16.2651L15.7901 15.3435C15.9503 15.1837 16.2047 14.9909 16.5015 14.9909C16.7936 14.9909 17.0338 15.1743 17.1799 15.3341C17.1846 15.3388 17.1846 15.3388 17.1893 15.3435L19.7852 17.9341C20.2704 18.4137 19.7899 19.4057 19.7899 19.4057Z"
                    stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                />
            </svg>
        </div>
    `;
}

function buildCallRowHtml(call) {
    const createdAt = new Date(call.createdAt);
    const rawNumber = call.contact?.phoneNumber || "";
    const number = formatPhoneNumber(rawNumber);
    const label = call.contact?.name || call.contact?.memo || "\u00A0";
    const purpose = call.purpose || "통화 목적 없음";
    const time = formatTime(createdAt);

    return `
        <div class="ch-row" data-call-sid="${escapeAttr(call.callSid)}">
            <div class="ch-item">
                ${buildCallIconHtml()}

                <div class="ch-main">
                    <div class="ch-line">
                        <span class="ch-number">${escapeHtml(number)}</span>
                        <span class="ch-purpose">${escapeHtml(purpose)}</span>
                    </div>
                    <div class="ch-label">${escapeHtml(label)}</div>
                </div>

                <div class="ch-time">${time}</div>

                <div class="ch-actions">
                    <button class="icon-btn icon-btn--call" title="상세" data-action="detail">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                            xmlns="http://www.w3.org/2000/svg" role="img" aria-label="상세">
                            <path
                                d="M10 7L15 12L10 17"
                                stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                            />
                        </svg>
                    </button>
                </div>
            </div>

            <button
                class="icon-btn icon-btn--add"
                title="연락처 추가"
                data-action="add-contact"
                data-phone="${escapeAttr(number)}"
            >
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none"
                    xmlns="http://www.w3.org/2000/svg" role="img" aria-label="연락처 추가">
                    <path
                        d="M1.7998 25.1999C1.79974 25.7522 2.24741 26.2 2.79969 26.2C3.35198 26.2001 3.79974 25.7524 3.7998 25.2002L2.7998 25.2L1.7998 25.1999ZM2.80028 20.9996L3.80028 20.9997L2.80028 20.9996ZM14.6998 17.8C15.2521 17.8 15.6998 17.3523 15.6998 16.8C15.6998 16.2478 15.2521 15.8 14.6998 15.8V16.8V17.8ZM25.1998 19.2C25.7521 19.2 26.1998 18.7523 26.1998 18.2C26.1998 17.6478 25.7521 17.2 25.1998 17.2V18.2V19.2ZM18.8998 17.2C18.3475 17.2 17.8998 17.6478 17.8998 18.2C17.8998 18.7523 18.3475 19.2 18.8998 19.2V18.2V17.2ZM21.0498 21.3499C21.0498 21.9022 21.4975 22.3499 22.0498 22.3499C22.6021 22.3499 23.0498 21.9022 23.0498 21.3499H22.0498H21.0498ZM23.0498 15.0499C23.0498 14.4976 22.6021 14.0499 22.0498 14.0499C21.4975 14.0499 21.0498 14.4976 21.0498 15.0499H22.0498H23.0498ZM16.7998 7.00005H15.7998C15.7998 8.76736 14.3671 10.2 12.5998 10.2V11.2V12.2C15.4717 12.2 17.7998 9.87193 17.7998 7.00005H16.7998ZM12.5998 11.2V10.2C10.8325 10.2 9.3998 8.76736 9.3998 7.00005H8.3998H7.3998C7.3998 9.87193 9.72792 12.2 12.5998 12.2V11.2ZM8.3998 7.00005H9.3998C9.3998 5.23274 10.8325 3.80005 12.5998 3.80005V2.80005V1.80005C9.72792 1.80005 7.3998 4.12817 7.3998 7.00005H8.3998ZM12.5998 2.80005V3.80005C14.3671 3.80005 15.7998 5.23274 15.7998 7.00005H16.7998H17.7998C17.7998 4.12817 15.4717 1.80005 12.5998 1.80005V2.80005ZM2.7998 25.2L3.7998 25.2002L3.80028 20.9997L2.80028 20.9996L1.80028 20.9995L1.7998 25.1999L2.7998 25.2ZM7.00028 16.8V15.8C4.12862 15.8 1.8006 18.1278 1.80028 20.9995L2.80028 20.9996L3.80028 20.9997C3.80048 19.2325 5.23311 17.8 7.00028 17.8V16.8ZM7.00028 16.8V17.8H14.6998V16.8V15.8H7.00028V16.8ZM25.1998 18.2V17.2H22.0498V18.2V19.2H25.1998V18.2ZM22.0498 18.2V17.2H18.8998V18.2V19.2H22.0498V18.2ZM22.0498 21.3499H23.0498V18.2H22.0498H21.0498V21.3499H22.0498ZM22.0498 18.2H23.0498V15.0499H22.0498H21.0498V18.2H22.0498V18.2Z"
                        fill="black"
                    />
                </svg>
            </button>
        </div>
    `;
}

function formatPhoneNumber(raw) {
    const digits = String(raw || "").replace(/\D/g, "");
    if (!digits) return "";

    // 한국 휴대폰: 010XXXXXXXX
    if (digits.startsWith("010") && digits.length === 11) {
        return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    }

    // 서울: 02XXXXXXXX or 02XXXXXXX
    if (
        digits.startsWith("02") &&
        (digits.length === 9 || digits.length === 10)
    ) {
        if (digits.length === 9) {
            return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(
                5
            )}`;
        }
        return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    }

    // 기타 지역번호: 0XX / 0XXX
    if (
        digits.startsWith("0") &&
        (digits.length === 10 || digits.length === 11)
    ) {
        const area3 = digits.slice(0, 3); // 031, 051 ...
        if (digits.length === 10) {
            return `${area3}-${digits.slice(3, 6)}-${digits.slice(6)}`;
        }
        return `${area3}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    }

    // 그 외는 숫자만 반환(최소 안전)
    return digits;
}

function escapeHtml(str) {
    return String(str || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function escapeAttr(str) {
    return escapeHtml(str).replaceAll("`", "&#96;");
}

async function fetchCallHistory(userId) {
    const res = await fetch(
        `/calls/history?userId=${encodeURIComponent(userId)}&limit=50`,
        { credentials: "include" }
    );

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.error || "통화 기록 조회 실패");
    }

    return Array.isArray(data.calls) ? data.calls : [];
}

function renderCallHistory(calls) {
    const root = document.getElementById("call-history-root");
    if (!root) return;

    if (!calls.length) {
        root.innerHTML = `<div class="ch-empty">통화 기록이 없습니다.</div>`;
        return;
    }

    // 1) 날짜별 그룹핑
    const groups = new Map();
    for (const call of calls) {
        const d = new Date(call.createdAt);
        const key = dateKey(d);

        if (!groups.has(key)) {
            groups.set(key, { date: d, items: [] });
        }
        groups.get(key).items.push(call);
    }

    // 2) 그룹 내부 최신순 정렬
    for (const g of groups.values()) {
        g.items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // 3) 날짜 그룹 최신순 정렬
    const sortedGroups = Array.from(groups.values()).sort(
        (a, b) => b.date - a.date
    );

    root.innerHTML = sortedGroups
        .map((g) => {
            const title = formatSectionTitle(g.date);
            const rows = g.items.map(buildCallRowHtml).join("");

            return `
                <section class="ch-section">
                    <h3 class="ch-section-title">${escapeHtml(title)}</h3>
                    <div class="ch-list">${rows}</div>
                </section>
            `;
        })
        .join("");

    // 이벤트 위임(이게 제일 안정적): row 클릭 + 버튼 클릭 분리
    root.addEventListener("click", (e) => {
        const target = e.target;
        const actionEl = target.closest("[data-action]");
        const row = target.closest(".ch-row");

        // 버튼 액션 처리
        if (actionEl) {
            e.stopPropagation();

            const action = actionEl.getAttribute("data-action");
            if (action === "add-contact") {
                const phone = actionEl.getAttribute("data-phone") || "";
                console.log("연락처 추가(미구현):", phone);
                // window.location.href = `add_contact.html?phone=${encodeURIComponent(phone)}`;
                return;
            }

            if (action === "detail") {
                const callSid = row?.getAttribute("data-call-sid");
                if (!callSid) return;
                window.location.href = `call_details.html?callSid=${encodeURIComponent(
                    callSid
                )}`;
                return;
            }
        }

        // row 클릭 처리
        if (row) {
            const callSid = row.getAttribute("data-call-sid");
            if (!callSid) return;
            window.location.href = `call_details.html?callSid=${encodeURIComponent(
                callSid
            )}`;
        }
    });

    root.querySelectorAll(".ch-row").forEach((row) => {
        row.style.cursor = "pointer";
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        await requireAnyUser();

        const userId = await ensureUserId();
        const calls = await fetchCallHistory(userId);

        renderCallHistory(calls);
    } catch (e) {
        console.error(e);
        const root = document.getElementById("call-history-root");
        if (root) {
            root.innerHTML = `<div class="ch-empty">통화 기록을 불러오지 못했습니다.</div>`;
        }
    }
});
