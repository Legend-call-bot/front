// src/routes/userRoutes.js
const crypto = require("crypto");
const prisma = require("../db/prisma");
const { getUserVoiceId, setUserVoiceSetting } = require("../config/voice");

function registerUserRoutes(app) {
    // 로그인 없이 userId 발급 (세션 사용자)
    app.post("/api/users/session", async (req, res) => {
        try {
            const { name, memo } = req.body || {};

            const user = await prisma.user.create({
                data: {
                    // 현재 스키마가 phoneNumber @unique라 임시 유니크 값 필요
                    phoneNumber: `session:${crypto.randomUUID()}`,
                    name: name || null,
                    memo: memo || null,

                    preferredVoiceId: null,
                },
                select: { id: true },
            });

            return res.status(201).json({ userId: user.id });
        } catch (err) {
            console.error("create session user error:", err);
            return res.status(500).json({ error: err.message });
        }
    });

    // 유저 프로필 조회(선택) - 보이스 관련 필드는 다루지 않음
    app.get("/api/users/:id", async (req, res) => {
        try {
            const { id } = req.params;

            const user = await prisma.user.findUnique({
                where: { id },
                select: {
                    id: true,
                    phoneNumber: true,
                    name: true,
                    memo: true,
                    createdAt: true,
                    updatedAt: true,
                },
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

    // 유저 프로필 수정
    app.put("/api/users/:id", async (req, res) => {
        try {
            const { id } = req.params;
            const { name = undefined, memo = undefined, preferredVoiceId = undefined } = req.body || {};

            if (preferredVoiceId !== undefined) {
                console.warn("[USER UPDATE] preferredVoiceId is ignored. Use /api/users/:id/voice instead.", {
                    userId: id,
                    preferredVoiceId,
                });
            }

            if (name === undefined && memo === undefined) {
                return res.status(400).json({
                    error: "no updatable fields (name, memo)",
                });
            }

            const exists = await prisma.user.findUnique({
                where: { id },
                select: { id: true },
            });

            if (!exists) {
                return res.status(404).json({ error: "user not found" });
            }

            const updatedUser = await prisma.user.update({
                where: { id },
                data: {
                    ...(name !== undefined ? { name: name || null } : {}),
                    ...(memo !== undefined ? { memo: memo || null } : {}),
                },
                select: {
                    id: true,
                    phoneNumber: true,
                    name: true,
                    memo: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });

            return res.json({ user: updatedUser });
        } catch (err) {
            console.error("update user error:", err);
            return res.status(500).json({ error: err.message });
        }
    });

    // 사용자 보이스 설정 조회
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
    app.put("/api/users/:id/voice", async (req, res) => {
        try {
            const { id } = req.params;
            const { presetKey = null, voiceId = null } = req.body || {};

            if (!presetKey && !voiceId) {
                return res.status(400).json({
                    error: "presetKey or voiceId is required",
                });
            }

            // UserVoiceSetting만 갱신 (User 테이블에는 동기화하지 않음)
            await setUserVoiceSetting(id, { presetKey, voiceId });

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
