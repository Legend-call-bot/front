// src/routes/authRoutes.js
const passport = require("passport");

function registerAuthRoutes(app) {
    app.get("/auth/google",
        passport.authenticate("google", { scope: ["profile", "email"] })
    );

    app.get("/auth/google/callback",
        passport.authenticate("google", { failureRedirect: "/public/pages/call.html?login=fail" }),
        (req, res) => {
            // 로그인 성공 → call.html로 이동
            res.redirect("/pages/call.html?login=success");
        }
    );

    app.get("/api/me", (req, res) => {
        if (!req.user) {
            return res.status(401).json({ error: "unauthorized" });
        }

        return res.json({
            user: {
                id: req.user.id,
                name: req.user.name,
                email: req.user.email,
            },
        });
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
