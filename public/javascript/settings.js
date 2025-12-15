// settings.js

const SERVER_URL = window.location.origin;

const VOICE_PRESETS = new Set([
    "friendly_female",
    "firm_female",
    "calm_female",
    "warm_female",
]);

function resetUserId() {
    localStorage.removeItem("userId");
}

async function getLoggedInUserId() {
    try {
        const res = await fetch(`${SERVER_URL}/api/me`, {
            credentials: "include",
        });

        if (!res.ok) return null;

        const data = await res.json().catch(() => ({}));
        return data && data.user && data.user.id ? data.user.id : null;
    } catch (e) {
        return null;
    }
}

async function ensureUserId() {
    // 1) 구글 로그인 유저면 항상 이 ID 사용
    const loggedInUserId = await getLoggedInUserId();
    if (loggedInUserId) {
        localStorage.setItem("userId", loggedInUserId);
        return loggedInUserId;
    }

    // 2) (선택) 비로그인 사용 시: 기존 session userId 사용/발급
    let userId = localStorage.getItem("userId");
    if (userId) return userId;

    const res = await fetch(`${SERVER_URL}/api/users/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.userId) {
        throw new Error(data.error || "userId 발급 실패");
    }

    localStorage.setItem("userId", data.userId);
    return data.userId;
}

async function fetchUserVoiceSetting(userId) {
    const res = await fetch(
        `${SERVER_URL}/api/users/${encodeURIComponent(userId)}/voice`,
        {
            credentials: "include",
        }
    );

    const data = await res.json().catch(() => ({}));

    if (res.status === 404) {
        // DB에서 유저가 삭제된 상태
        resetUserId();
        const newUserId = await ensureUserId();
        return fetchUserVoiceSetting(newUserId);
    }

    if (!res.ok) {
        throw new Error(data.error || "보이스 설정 조회 실패");
    }

    return {
        presetKey: data.presetKey || null,
        voiceId: data.voiceId || null,
    };
}

async function updateUserVoiceSetting(userId, payload) {
    const res = await fetch(
        `${SERVER_URL}/api/users/${encodeURIComponent(userId)}/voice`,
        {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }
    );

    const data = await res.json().catch(() => ({}));

    if (res.status === 404) {
        resetUserId();
        const newUserId = await ensureUserId();
        return updateUserVoiceSetting(newUserId, payload);
    }

    if (!res.ok) {
        throw new Error(data.error || "보이스 설정 저장 실패");
    }

    return data;
}

function applySettingToForm(form, setting) {
    const presetKey = setting?.presetKey || null;

    if (presetKey && VOICE_PRESETS.has(presetKey) && form.voice) {
        form.voice.value = presetKey;
    }

    const savedSpeed = localStorage.getItem("ttsSpeed");
    if (savedSpeed && form.speed) {
        form.speed.value = savedSpeed;
    }
}

window.addEventListener("DOMContentLoaded", async () => {
    const form = document.getElementById("settingsForm");
    const previewBtn = document.querySelector(".preview-btn");
    const submitBtn = form
        ? form.querySelector('button[type="submit"]')
        : null;

    if (!form) return;

    if (submitBtn) submitBtn.disabled = true;
    if (previewBtn) previewBtn.disabled = true;

    try {
        // 로그인 유저 우선으로 userId 확정
        const userId = await ensureUserId();

        // 서버 값 로드
        try {
            const setting = await fetchUserVoiceSetting(userId);
            applySettingToForm(form, setting);
        } catch (e) {
            console.warn("보이스 설정 조회 실패(기본값 유지):", e);
        }

        // 저장
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (submitBtn) submitBtn.disabled = true;

            try {
                const presetKey = form.voice ? form.voice.value : null;
                const speed = form.speed ? form.speed.value : "normal";

                localStorage.setItem("ttsSpeed", speed);

                if (!presetKey || !VOICE_PRESETS.has(presetKey)) {
                    alert("목소리 프리셋 값이 올바르지 않습니다.");
                    return;
                }

                // 저장 시에도 로그인 유저 우선
                const currentUserId = await ensureUserId();

                await updateUserVoiceSetting(currentUserId, { presetKey });

                window.location.href = "/pages/call.html";
            } catch (err) {
                console.error("보이스 설정 저장 실패:", err);
                alert(err.message || "보이스 설정 저장 실패");
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });

        // 미리듣기
        if (previewBtn) {
            previewBtn.addEventListener("click", async () => {
                if (previewBtn) previewBtn.disabled = true;

                try {
                    const voice = form.voice ? form.voice.value : null;
                    const speed = form.speed ? form.speed.value : "normal";

                    const res = await fetch(`${SERVER_URL}/tts-preview`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ voice, speed }),
                    });

                    const data = await res.json().catch(() => ({}));

                    if (!res.ok || !data.audioUrl) {
                        throw new Error(data.error || "TTS 미리듣기 생성 실패");
                    }

                    const audio = new Audio(data.audioUrl);
                    audio.play();
                } catch (err) {
                    console.error("미리듣기 실패:", err);
                    alert(err.message || "미리듣기 실패");
                } finally {
                    if (previewBtn) previewBtn.disabled = false;
                }
            });
        }
    } catch (err) {
        console.error("settings 초기화 실패:", err);
        alert(err.message || "설정 초기화 실패");
    } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (previewBtn) previewBtn.disabled = false;
    }
});
