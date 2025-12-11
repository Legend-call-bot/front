// src/routes/twilioRoutes.js
const { PUBLIC_HOST } = require("../config/env");

function registerTwilioRoutes(app) {
    app.all("/twilio/answer", (req, res) => {
        const audioUrl = req.query.audioUrl;
        const callSid = req.body?.CallSid || req.query?.CallSid || "unknown";

        const wsBase = PUBLIC_HOST.startsWith("https")
            ? PUBLIC_HOST.replace(/^https/, "wss")
            : PUBLIC_HOST.replace(/^http/, "ws");
        const wsUrl = `${wsBase}/media?callSid=${encodeURIComponent(callSid)}`;

        const twiml = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            "<Response>",
            `<Start><Stream url=\"${wsUrl}\"/></Start>`,
            `<Play>${audioUrl}</Play>`,
            '<Pause length="60"/>',
            `<Redirect method=\"POST\">${PUBLIC_HOST}/twilio/hold</Redirect>`,
            "</Response>",
        ];
        res.type("text/xml").send(twiml.join("\n"));
    });

    app.all("/twilio/hold", (req, res) => {
        const callSid = req.body?.CallSid || req.query?.CallSid || "unknown";
        const wsUrl = `${PUBLIC_HOST.replace(
            /^http/,
            "ws"
        )}/media?callSid=${encodeURIComponent(callSid)}`;
        const twiml = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            "<Response>",
            `<Start><Stream url=\"${wsUrl}\"/></Start>`,
            '<Pause length="60"/>',
            `<Redirect method=\"POST\">${PUBLIC_HOST}/twilio/hold</Redirect>`,
            "</Response>",
        ];
        res.type("text/xml").send(twiml.join("\n"));
    });
}

module.exports = registerTwilioRoutes;
