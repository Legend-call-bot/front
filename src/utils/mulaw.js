// src/utils/mulaw.js
function mulawToPcm16(mulawBuffer) {
    const out = Buffer.alloc(mulawBuffer.length * 2);
    for (let i = 0; i < mulawBuffer.length; i++) {
        let mu = ~mulawBuffer[i] & 0xff;
        const sign = mu & 0x80 ? -1 : 1;
        const exponent = (mu >> 4) & 0x07;
        const mantissa = mu & 0x0f;
        let sample = ((mantissa << 3) + 0x84) << exponent;
        sample = sign * sample;
        out.writeInt16LE(sample, i * 2);
    }
    return out;
}

module.exports = {
    mulawToPcm16,
};
