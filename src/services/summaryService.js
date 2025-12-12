const { genAI } = require("../config/env");
const prisma = require("../db/prisma");

async function summarizeCall(callSid, history, io) {
    try {
        const model = genAI.getGenerativeModel({
            model: "models/gemini-2.0-flash",
        });

        const transcript = history
            .map((m) => `${m.role === "user" ? "손님" : "직원"}: ${m.content}`)
            .join("\n");

        const prompt = `
다음은 손님과 직원 간의 전화 대화 기록입니다.

대화 내용을 **3줄 이내**로 간단히 요약하세요.
중요 정보(예약 시간, 날짜, 인원, 요청사항 등)가 있다면 포함하세요.
불필요한 말투 제거하고 사실만 정리하세요.

대화 기록:
${transcript}
`;

        const result = await model.generateContent(prompt);
        const summary = result.response.text().trim();

        console.log("📄 통화 요약 생성 완료:\n", summary);

        if (callSid) {
            await prisma.call.update({
                where: { callSid },
                data: {
                    transcript,
                    summary,
                },
            });

            io.to(callSid).emit("call.summary", { callSid, summary });
        }

        return summary;
    } catch (err) {
        console.error("요약 생성 오류:", err);
        return null;
    }
}

module.exports = {
    summarizeCall,
};
