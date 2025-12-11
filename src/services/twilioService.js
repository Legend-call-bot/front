// src/services/twilioService.js
const { twilioClient, PUBLIC_HOST } = require("../config/env");

async function playToCall(callSid, audioUrl) {
    const base = PUBLIC_HOST;
    const wsBase = base.startsWith("https")
        ? base.replace(/^https/, "wss")
        : base.replace(/^http/, "ws");
    const wsUrl = `${wsBase}/media?callSid=${encodeURIComponent(callSid)}`;

    const twiml = [
        "<Response>",
        `<Start><Stream url=\"${wsUrl}\"/></Start>`,
        `<Play>${audioUrl}</Play>`,
        `<Pause length=\"1\"/>`,
        `<Redirect method=\"POST\">${base}/twilio/hold</Redirect>`,
        "</Response>",
    ].join("");

    console.log("📨 Twilio update callSid:", callSid);

    return twilioClient.calls(callSid).update({ twiml });
}

module.exports = {
    playToCall,
};
