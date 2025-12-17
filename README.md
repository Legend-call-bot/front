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
### Frontend
- HTML, CSS, Vanilla JavaScript
- Socket.IO Client

### Backend
- Node.js
- Express
- WebSocket (Twilio Media Stream)
- Socket.IO

### Voice / AI
- Twilio (Call, TwiML, Media Stream)
- Azure Speech-to-Text (Streaming)
- Gemini (대화 추천 멘트, 통화 요약)
- ElevenLabs (TTS)

### Database / Infra
- PostgreSQL
- Prisma ORM
- Docker / Docker Compose
- ngrok

## 핵심 기능

### 전화 발신 및 통화 제어
- 웹에서 발신 요청 시 Twilio Call API로 전화 연결
- TwiML을 통해 통화 시작, 대기, 음성 재생 등 통화 흐름 제어
- 통화 상태 콜백을 수신해 실시간 상태 동기화

### 실시간 음성 인식 및 자막
- Twilio Media Stream을 WebSocket으로 수신
- μ-law 음성을 PCM으로 변환 후 Azure STT로 실시간 음성 인식
- 인식 결과를 자막 형태로 프론트에 실시간 전달

### 대화 지원 (추천 답변)
- STT 결과를 기반으로 Gemini가 상황별 추천 답변 생성
- 추천 멘트를 프론트에 실시간 제공하여 전화 응대 보조

### TTS 생성 및 통화 중 재생
- 추천 멘트 또는 사용자 입력 문장을 ElevenLabs TTS로 음성 생성
- 생성된 음성을 통화 중 실시간 재생하거나 웹에서 미리듣기 지원

### 통화 요약 및 기록
- 통화 종료 시 전체 대화를 Gemini로 요약
- 요약 및 대화 기록을 DB에 저장하고 조회 가능

## 실시간 음성 처리 아키텍처

1. 웹에서 전화 발신 요청
2. Twilio가 전화를 연결하고 Media Stream으로 음성 송출
3. 서버가 음성을 WebSocket으로 수신 후 STT 수행
4. 인식된 텍스트로 추천 멘트 생성 및 실시간 전달
5. 선택된 멘트를 TTS로 생성해 통화 중 재생
6. 통화 종료 후 요약 생성 및 저장

> 파이프라인 요약  
> Twilio Media Stream → WebSocket → Azure STT → Gemini → Socket.IO → (ElevenLabs TTS)

## 폴더 구조
```text
front/                  # Node(Express) 서버 + 정적 프론트(바닐라 JS) 통합 디렉터리
├─ public/              # 프론트 정적 리소스(HTML/CSS/JS)
├─ src/                 # 서버 핵심 로직
│  ├─ routes/           # HTTP API 라우트(auth/user/call/twilio)
│  ├─ sockets/          # 실시간 처리(WebSocket: Media Stream, Socket.IO)
│  ├─ services/         # 외부 연동 로직(Twilio, ElevenLabs, Gemini 등)
│  ├─ config/           # 환경변수 및 외부 클라이언트 초기화
│  ├─ auth/             # Google OAuth 설정
│  ├─ db/               # Prisma 클라이언트
│  └─ utils/            # 오디오 유틸(μ-law→PCM 변환 등)
├─ audio/               # TTS로 생성된 mp3 파일 정적 서빙
├─ prisma/              # Prisma 스키마/마이그레이션
├─ server.js            # 서버 엔트리
├─ docker-compose.yml   # 로컬 Postgres 실행
└─ .env.example         # 환경변수 템플릿
```

## 실행 방법
### 1️⃣ 사전 준비
-   Node.js (권장: LTS)
-   Docker / Docker Compose
-   ngrok
-   계정 및 API Key: Twilio, Azure STT, ElevenLabs, Gemini API

### 2️⃣ 환경변수 설정
프로젝트 루트(`front/`)에 `.env` 파일을 생성하고 아래 값을 설정합니다.  
필수 값은 `.env.example` 파일을 참고하세요.

```text
# Server
PORT=3003
PUBLIC_HOST=
SERVER_URL=

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_API_KEY=
TWILIO_API_SECRET=
TWILIO_TWIML_APP_SID=
TWILIO_FROM_NUMBER=
TWILIO_CALLER_ID=
TWILIO_MEDIA_STREAM_URL=    # (선택) 기본적으로 PUBLIC_HOST 기반 동작

# STT / LLM
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=
GEMINI_API_KEY=

# ElevenLabs
ELEVENLABS_API_KEY=
ELEVENLABS_MODEL_ID=
ELEVENLABS_VOICE_ID=

# ElevenLabs Voice Presets
ELEVENLABS_VOICE_ID_BRIGHT=
ELEVENLABS_VOICE_ID_CLEAR=
ELEVENLABS_VOICE_ID_CALM=
ELEVENLABS_VOICE_ID_WARM=

# Database
DATABASE_URL=
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=
POSTGRES_PORT=
POSTGRES_HOST=

# Auth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=
SESSION_SECRET=
```

### 3️⃣ 서버 실행
```bash
npm install
docker-compose up -d   # Postgres 실행
node server.js         # 서버 실행
```

### 4️⃣ 외부 접근 설정 (ngrok)
Twilio Webhook 및 Media Stream 연결을 위해 ngrok으로 서버를 외부에 노출합니다.
ngrok에서 발급된 URL을 PUBLIC_HOST 환경변수에 설정합니다.
```bash
ngrok http 3003
```

## 주요 엔드포인트
| 구분 | Method | Path | 설명 |
| --- | --- | --- | --- |
| Client | POST | `/calls` | 전화 발신 요청 (시작 멘트 생성 후 Twilio 발신) |
| Client | GET | `/calls/history` | 통화 기록 조회 |
| Client | POST | `/tts-preview` | TTS 미리듣기 |
| Twilio | POST | `/call-status` | 통화 상태 콜백 |
| Twilio | ALL | `/twilio/answer` | TwiML 응답 (스트림 시작 + 시작 멘트 재생) |
| Twilio | ALL | `/twilio/hold` | TwiML 응답 (대기 유지 + 스트림 유지) |


## 트러블슈팅

- **Google OAuth 로그인 후 로그인 전 화면으로 되돌아가는 이슈**
  - 세션 기반 인증과 프론트 상태(`localStorage userId`)가 불일치하여 발생
  - 로그인 성공 후 세션 사용자 기준으로 상태를 재동기화하여 해결  
    (`passport serialize/deserialize` + `/api/me` 조회)

- **사용자별 보이스 설정 구조 변경**
  - User 테이블의 선호 보이스 필드를 제거하고 보이스 설정을 `UserVoiceSetting` 테이블로 분리
  - 보이스 선택 우선순위를 프리셋 → 사용자 설정(DB) → 기본값 순으로 정리

- **Prisma 스키마 변경 후 실행 오류**
  - 스키마 변경 후 Prisma Client 반영이 누락되어 런타임 오류 발생
  - 브라우저 콘솔에서 `localStorage userId`를 삭제 후 새로고침하여 복구
    ```js
    localStorage.removeItem("userId");
    location.reload();
    ```
