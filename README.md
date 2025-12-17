# CallBa
콜포비아 사용자를 위한 **전화 발신 보조 웹 서비스**  

팀명: Legend  
기간: 2025.09.04 – 2025.12.18  

## 팀원
| 역할 | 이름   | 담당 |
| ---- | ------ | ---- |
| 팀장 | 하서경 |      |
| 팀원 | 김나림 |      |
| 팀원 | 윤예진 |      |
| 팀원 | 임은서 |      |

## 기술 스택
- Twilio 기반 통화 연결
- 실시간 음성 스트리밍(WebSocket)
- STT(Azure)
- 대화 지원(LLM)
- TTS(ElevenLabs)

## 핵심 기능
-   **전화 발신/연결**: Twilio Call + TwiML 응답
-   **실시간 음성 처리**: Twilio Media Stream → WebSocket 수신
-   **실시간 STT**: Azure Speech-to-Text로 음성 → 텍스트 변환
-   **대화 지원**: Gemini 기반 추천 멘트/요약 제공
-   **TTS 미리듣기/생성**: ElevenLabs로 음성 파일 생성 및 재생

## 시스템 아키텍처
1. 사용자가 웹에서 발신 요청
2. Twilio가 전화를 연결하고 Media Stream을 WebSocket으로 송출
3. 서버가 스트림을 받아 Azure STT로 텍스트 변환
4. 변환 텍스트를 Gemini로 보내 추천 멘트/요약 생성
5. 필요 시 ElevenLabs로 TTS 생성 후 Twilio로 재생/전달

## 실시간 음성 파이프라인
Twilio Media Stream(μ-law) → mulaw.js(PCM 변환) → Azure STT → Gemini(추천/요약) → socket.io로 프론트 푸시

## 폴더 구조
콜바(CallBar) 프로젝트의 서버 디렉터리 구조입니다.

```text
front/
    audio/                        // TTS로 생성된 오디오 파일 저장
    node_modules/                 // 의존성
    prisma/                       // DB
    public/                       // 정적 리소스
        css/                      // 공통 스타일
        javascript/               // 브라우저 스크립트
        pages/                    // HTML 페이지
    src/
        auth/
            passport.js           // Google OAuth 전략/세션 설정
        config/
            env.js                // 환경변수 로딩, 외부 클라이언트 초기화
            voice.js              // 음성 프리셋 매핑
        db/
            prisma.js
        routes/
            authRoutes.js         // 로그인, 콜백, 로그아웃 등
            callRoutes.js         // 통화 생성, 상태, 미리듣기
            twilioRoutes.js       // TwiML 응답, 콜백
            userRoutes.js         // 프로필, 보이스 설정
        services/
            ttsService.js         // ElevenLabs TTS, 오디오 파일 생성
            twilioService.js      // Twilio Call 생성/업데이트/제어
            summaryService.js     // 통화 요약 (Gemini)
        sockets/
            mediaSocket.js        // Twilio Media WebSocket + Azure STT + Gemini 추천
            frontendSocket.js     // 프론트 실시간 이벤트(자막/추천멘트/상태) 처리
        utils/
            audio.js              // 파일 경로
            mulaw.js              // 오디오 전처리: μ-law → PCM 변환
    .env
    .env.example
    .gitignore
    docker-compose.yml            // Postgres 로컬 실행
    package-lock.json
    prisma.config.ts
    README.md
    server.js                     // 엔트리: 서버 생성 + 미들웨어/라우트/소켓 초기화만 담당
```

## 실행 방법
1️⃣ 필수 준비물
-   Node.js (권장: LTS)
-   Docker / Docker Compose
-   ngrok
-   계정/키: Twilio, Azure Speech, ElevenLabs, (Gemini API)

2️⃣ 환경변수 설정
.env 파일에 아래 값들을 채웁니다.

```text
# 서버 기본 설정
PORT=3003
PUBLIC_HOST=
SERVER_URL=

# Twilio 설정
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_API_KEY=
TWILIO_API_SECRET=
TWILIO_TWIML_APP_SID=
TWILIO_FROM_NUMBER=
TWILIO_CALLER_ID=
TWILIO_MEDIA_STREAM_URL=

# STT(Azure) / LLM(Gemini)
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=
GEMINI_API_KEY=

# ElevenLabs 설정
ELEVENLABS_API_KEY=
ELEVENLABS_MODEL_ID=
ELEVENLABS_VOICE_ID=

# ElevenLabs 프리셋 보이스
ELEVENLABS_VOICE_ID_BRIGHT=
ELEVENLABS_VOICE_ID_CLEAR=
ELEVENLABS_VOICE_ID_CALM=
ELEVENLABS_VOICE_ID_WARM=

# DB
DATABASE_URL=
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=
POSTGRES_PORT=
POSTGRES_HOST=

# Google OAuth / 로그인 세션
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=
SESSION_SECRET=
```

3️⃣ 실행

```bash
npm install
docker-compose up -d
node server.js
ngrok http 3003
```

## 주요 엔드포인트

-   POST /calls : 전화 발신 요청
-   POST /call-status : Twilio 통화 상태 콜백
-   GET /tts-preview : TTS 미리듣기
-   POST /twilio/answer : Twilio 응답(TwiML)
-   POST /twilio/hold : 대기/재생 제어

## 트러블슈팅
TODO: 주요 이슈 및 해결 과정 정리 예정
