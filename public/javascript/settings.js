// settings.js

const SERVER_URL = window.location.origin;

function getUserIdFromUrlOrStorage() {
    const params = new URLSearchParams(window.location.search);
    const userIdFromUrl = params.get("userId");
    return userIdFromUrl || localStorage.getItem("userId");
}

function resetUserId() {
    localStorage.removeItem("userId");
}

async function ensureUserId() {
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

const VOICE_PRESETS = new Set([
    "friendly_female",
    "firm_female",
    "calm_female",
    "warm_female",
]);

async function fetchUserVoiceSetting(userId) {
    const res = await fetch(
        `${SERVER_URL}/api/users/${encodeURIComponent(userId)}/voice`
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

    // 서버 응답: { voiceId, presetKey }
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
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }
    );

    const data = await res.json().catch(() => ({}));

    if (res.status === 404) {
        // DB에서 유저가 삭제된 상태면 자동 복구 후 재시도
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

    // presetKey가 유효하면 그대로 설정
    if (presetKey && VOICE_PRESETS.has(presetKey) && form.voice) {
        form.voice.value = presetKey;
    }

    // speed는 로컬 저장 유지 (현재 서버에 speed 저장 안함)
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

    // 초기에는 막고 시작
    if (submitBtn) submitBtn.disabled = true;
    if (previewBtn) previewBtn.disabled = true;

    try {
        // userId 확보(없으면 발급)
        let userId = getUserIdFromUrlOrStorage();
        if (!userId) {
            userId = await ensureUserId();
        } else {
            localStorage.setItem("userId", userId);
        }

        // 서버 값 로드(404면 자동 복구됨)
        try {
            const setting = await fetchUserVoiceSetting(userId);
            applySettingToForm(form, setting);
        } catch (e) {
            console.warn("보이스 설정 조회 실패(기본값 유지):", e);
        }

        // 완료(저장)
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

                const currentUserId =
                    localStorage.getItem("userId") || (await ensureUserId());

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
                        throw new Error(
                            data.error || "TTS 미리듣기 생성 실패"
                        );
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
        // 초기화 끝나면 풀기
        if (submitBtn) submitBtn.disabled = false;
        if (previewBtn) previewBtn.disabled = false;
    }
});
