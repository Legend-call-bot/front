// server.js
require("dotenv").config();

const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const passport = require("passport");
const { createServer } = require("http");
const { Server: IOServer } = require("socket.io");
const { AUDIO_DIR } = require("./src/utils/audio");
const { PORT } = require("./src/config/env");

const registerAuthRoutes = require("./src/routes/authRoutes");
const registerUserRoutes = require("./src/routes/userRoutes");
const registerCallRoutes = require("./src/routes/callRoutes");
const registerTwilioRoutes = require("./src/routes/twilioRoutes");
const initFrontendSocket = require("./src/sockets/frontendSocket");
const initMediaSocket = require("./src/sockets/mediaSocket");

require("./src/auth/passport");

const app = express();
const httpServer = createServer(app);
const io = new IOServer(httpServer);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: false,
        },
    })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, "public")));
app.use("/audio", express.static(AUDIO_DIR));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public/pages/home.html"));
});

// 라우트 등록
registerAuthRoutes(app);
registerUserRoutes(app);
registerCallRoutes(app, io);
registerTwilioRoutes(app);

// 소켓 초기화
initFrontendSocket(io);
initMediaSocket(httpServer, io);

app.get("/health", (req, res) => res.json({ ok: true }));

httpServer.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
