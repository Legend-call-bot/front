// src/auth/passport.js
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const prisma = require("../db/prisma");

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await prisma.user.findUnique({ where: { id } });
        done(null, user || null);
    } catch (err) {
        done(err);
    }
});

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL,
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const googleId = profile.id;
                const email =
                    profile.emails && profile.emails[0]
                        ? profile.emails[0].value
                        : null;
                const name = profile.displayName || null;

                // 1) googleId로 기존 유저 찾기
                let user = await prisma.user.findUnique({
                    where: { googleId },
                });

                // 2) 없으면 email로도 한번 찾기(옵션)
                if (!user && email) {
                    user = await prisma.user.findUnique({
                        where: { email },
                    });
                }

                // 3) 없으면 생성
                if (!user) {
                    user = await prisma.user.create({
                        data: {
                            googleId,
                            email,
                            name,
                            phoneNumber: null,
                        },
                    });
                } else {
                    // 4) 있으면 googleId/email/name 갱신(선택)
                    user = await prisma.user.update({
                        where: { id: user.id },
                        data: {
                            googleId: user.googleId || googleId,
                            email: user.email || email,
                            name: user.name || name,
                        },
                    });
                }

                return done(null, user);
            } catch (err) {
                return done(err);
            }
        }
    )
);
