-- CreateTable
CREATE TABLE "UserVoiceSetting" (
    "userId" TEXT NOT NULL,
    "voicePreset" TEXT,
    "voiceId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserVoiceSetting_pkey" PRIMARY KEY ("userId")
);
