// src/routes/authRoutes.js
const passport = require("passport");
const prisma = require("../db/prisma");

function registerAuthRoutes(app) {
    app.get(
        "/auth/google",
        passport.authenticate("google", { scope: ["profile", "email"] })
    );

    app.get(
        "/auth/google/callback",
        passport.authenticate("google", {
            failureRedirect: "/pages/home.html?login=fail",
        }),
        (req, res) => {
            // 로그인 성공 → call.html로 이동
            res.redirect("/pages/call.html?login=success");
        }
    );

    app.get("/api/me", async (req, res) => {
        try {
            // 1) 구글 OAuth 로그인(=passport)
            if (req.user?.id) {
                return res.json({
                    user: {
                        id: req.user.id,
                        name: req.user.name,
                        email: req.user.email,
                    },
                });
            }

            // 2) "로그인 없이 session user 발급" 케이스
            const sessionUserId = req.session?.userId;
            if (!sessionUserId) {
                return res.status(401).json({ error: "unauthorized" });
            }

            const user = await prisma.user.findUnique({
                where: { id: sessionUserId },
                select: { id: true, name: true, email: true },
            });

            if (!user) {
                return res.status(404).json({ error: "user not found" });
            }

            return res.json({ user });
        } catch (err) {
            console.error("GET /api/me error:", err);
            return res.status(500).json({ error: "internal_error" });
        }
    });

    app.post("/auth/logout", (req, res) => {
        req.logout(() => {
            req.session.destroy(() => {
                res.json({ ok: true });
            });
        });
    });
}

module.exports = registerAuthRoutes;
