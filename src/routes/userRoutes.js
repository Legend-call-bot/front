// src/routes/userRoutes.js
const prisma = require("../db/prisma");

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
}

module.exports = registerUserRoutes;
