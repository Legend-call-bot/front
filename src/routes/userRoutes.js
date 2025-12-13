// src/routes/userRoutes.js
const crypto = require("crypto");
const prisma = require("../db/prisma");
const { getUserVoiceId, setUserVoiceSetting } = require("../config/voice");

function registerUserRoutes(app) {
    // 로그인 없이 userId 발급 (세션 사용자)
    app.post("/api/users/session", async (req, res) => {
        try {
            const { name, memo, preferredVoiceId } = req.body || {};

            const user = await prisma.user.create({
                data: {
                    // 현재 스키마가 phoneNumber @unique라 임시 유니크 값 필요
                    phoneNumber: `session:${crypto.randomUUID()}`,
                    name: name || null,
                    memo: memo || null,
                    preferredVoiceId: preferredVoiceId || null,
                },
                select: { id: true },
            });

            // 기존 preferredVoiceId를 새 UserVoiceSetting(SSOT=DB)에 반영
            if (preferredVoiceId) {
                await setUserVoiceSetting(user.id, {
                    presetKey: null,
                    voiceId: preferredVoiceId,
                });
            }

            return res.status(201).json({ userId: user.id });
        } catch (err) {
            console.error("create session user error:", err);
            return res.status(500).json({ error: err.message });
        }
    });

    // 유저 프로필 조회(선택)
    app.get("/api/users/:id", async (req, res) => {
        try {
            const { id } = req.params;

            const user = await prisma.user.findUnique({
                where: { id },
            });

            if (!user) {
                return res.status(404).json({ error: "user not found" });
            }

            return res.json({ user });
        } catch (err) {
            console.error("get user error:", err);
            return res.status(500).json({ error: err.message });
        }
    });

    // 사용자 보이스 설정 조회 (SSOT=UserVoiceSetting)
    // 응답: { voiceId, presetKey }
    app.get("/api/users/:id/voice", async (req, res) => {
        try {
            const { id } = req.params;

            const setting = await prisma.userVoiceSetting.findUnique({
                where: { userId: id },
                select: {
                    voicePreset: true,
                    voiceId: true,
                },
            });

            const resolvedVoiceId = await getUserVoiceId(id);

            return res.json({
                voiceId: resolvedVoiceId,
                presetKey: setting ? setting.voicePreset : null,
            });
        } catch (err) {
            console.error("get user voice error:", err);
            return res.status(500).json({ error: err.message });
        }
    });

    // 사용자 보이스 설정 저장/변경
    // body: { presetKey?: string, voiceId?: string }
    // 응답: { voiceId, presetKey }
    app.put("/api/users/:id/voice", async (req, res) => {
        try {
            const { id } = req.params;
            const { presetKey = null, voiceId = null } = req.body || {};

            if (!presetKey && !voiceId) {
                return res.status(400).json({
                    error: "presetKey or voiceId is required",
                });
            }

            await setUserVoiceSetting(id, { presetKey, voiceId });

            // (선택) 기존 User 테이블의 preferredVoiceId도 동기화하고 싶다면 유지
            // - presetKey만 온 경우엔 실제 voiceId를 resolve해야 하는데,
            //   여기서는 간단히 voiceId가 있을 때만 업데이트
            if (voiceId) {
                await prisma.user.update({
                    where: { id },
                    data: { preferredVoiceId: voiceId },
                });
            }

            const saved = await prisma.userVoiceSetting.findUnique({
                where: { userId: id },
                select: {
                    voicePreset: true,
                    voiceId: true,
                },
            });

            const resolvedVoiceId = await getUserVoiceId(id);

            return res.json({
                voiceId: resolvedVoiceId,
                presetKey: saved ? saved.voicePreset : null,
            });
        } catch (err) {
            console.error("update user voice error:", err);
            return res.status(500).json({ error: err.message });
        }
    });
}

module.exports = registerUserRoutes;
