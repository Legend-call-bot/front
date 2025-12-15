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
                    phoneNumber: null,
                    name: name || null,
                    memo: memo || null,
                },
                select: { id: true },
            });
            req.session.userId = user.id;
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
            const { name = undefined, memo = undefined } = req.body || {};

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

    // 현재 세션 기준 내 정보 조회
    app.get("/api/users/me", async (req, res) => {
        try {
            // passport 로그인(구글 OAuth) 케이스
            if (req.user?.id) {
                const user = await prisma.user.findUnique({
                    where: { id: req.user.id },
                    select: { id: true, name: true, email: true },
                });

                if (!user) {
                    return res.status(404).json({ error: "user not found" });
                }

                return res.json({ user });
            }

            // "로그인 없이 session userId 발급" 케이스를 위해
            // (session에 userId를 저장해두는 방식이면 아래처럼)
            const sessionUserId = req.session?.userId;

            if (!sessionUserId) {
                return res.status(401).json({ error: "not logged in" });
            }

            const user = await prisma.user.findUnique({
                where: { id: sessionUserId },
                select: { id: true, name: true },
            });

            if (!user) {
                return res.status(404).json({ error: "user not found" });
            }

            return res.json({ user });
        } catch (err) {
            console.error("get me error:", err);
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
