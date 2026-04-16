PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "EmailAccount" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "tokenExpiresAt" DATETIME,
  "imapHost" TEXT,
  "imapPort" INTEGER,
  "imapUser" TEXT,
  "imapPassword" TEXT,
  "imapTls" BOOLEAN NOT NULL DEFAULT 1,
  "calendarConnected" BOOLEAN NOT NULL DEFAULT 0,
  "calendarToken" TEXT,
  "calendarRefreshToken" TEXT,
  "lastSyncedAt" DATETIME,
  "syncEnabled" BOOLEAN NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Application" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "emailAccountId" TEXT,
  "company" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'APPLIED',
  "emailMessageId" TEXT,
  "emailSubject" TEXT,
  "aiConfidence" REAL,
  "notes" TEXT,
  "appliedAt" DATETIME,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Application_emailAccountId_fkey"
    FOREIGN KEY ("emailAccountId")
    REFERENCES "EmailAccount" ("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Interview" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "applicationId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "scheduledAt" DATETIME NOT NULL,
  "durationMinutes" INTEGER NOT NULL DEFAULT 60,
  "location" TEXT,
  "calendarEventId" TEXT,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Interview_applicationId_fkey"
    FOREIGN KEY ("applicationId")
    REFERENCES "Application" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "SyncJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "emailAccountId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "totalEmails" INTEGER,
  "parsedEmails" INTEGER,
  "errorMessage" TEXT,
  "startedAt" DATETIME,
  "completedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SyncJob_emailAccountId_fkey"
    FOREIGN KEY ("emailAccountId")
    REFERENCES "EmailAccount" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "AppSettings" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
  "syncIntervalMinutes" INTEGER NOT NULL DEFAULT 15,
  "initialSyncDays" INTEGER NOT NULL DEFAULT 90,
  "aiModel" TEXT NOT NULL DEFAULT 'gpt-5.4-mini'
);

CREATE UNIQUE INDEX IF NOT EXISTS "Application_emailAccountId_emailMessageId_key"
ON "Application" ("emailAccountId", "emailMessageId");

CREATE INDEX IF NOT EXISTS "Interview_applicationId_idx"
ON "Interview" ("applicationId");

CREATE INDEX IF NOT EXISTS "SyncJob_emailAccountId_idx"
ON "SyncJob" ("emailAccountId");
