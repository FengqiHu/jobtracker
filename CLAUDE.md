# Job Application Tracker — Claude Code Task Plan
# (Local Open-Source Tool Edition)

## Project Overview

A locally-deployed, single-user web application that tracks job application statuses
by connecting to one or more email accounts and using AI (Claude API) to automatically
extract company name, role, and application status from emails.

The app runs as a background process on the user's machine. The frontend is served by
the backend as static files. All data is stored in a local SQLite file. No cloud
infrastructure, no authentication, no multi-tenancy.

Target users: developers and job seekers who want to self-host and own their data.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | Vite + React + TypeScript | Fast dev server, lightweight build output |
| Styling | Tailwind CSS + shadcn/ui | Same as before, well-supported with Vite |
| Backend | Node.js + Express + TypeScript | Lightweight, no framework overhead |
| ORM | Prisma | Excellent SQLite support, great DX |
| Database | SQLite (via Prisma) | Zero infrastructure, single file, easy backup |
| AI | Anthropic Claude API | Email classification + parsing |
| Mail | Gmail API (OAuth2) + IMAP (imapflow) | Cover both Gmail and generic providers |
| Calendar | Google Calendar API | Interview scheduling |
| Scheduler | node-cron | Periodic email sync, no Redis needed |
| Process manager | PM2 | Keep backend alive in background |

---

## Repository Structure

```
job-tracker/
├── frontend/                  # Vite + React app
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/            # shadcn/ui primitives
│   │   │   ├── ApplicationCard.tsx
│   │   │   ├── ApplicationTable.tsx
│   │   │   ├── KanbanBoard.tsx
│   │   │   ├── MailboxManager.tsx
│   │   │   ├── InterviewCalendar.tsx
│   │   │   └── SyncStatusBar.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Applications.tsx
│   │   │   ├── Calendar.tsx
│   │   │   └── Settings.tsx
│   │   ├── lib/
│   │   │   ├── api.ts         # typed fetch wrappers
│   │   │   └── utils.ts
│   │   ├── hooks/
│   │   │   ├── useApplications.ts
│   │   │   ├── useSyncStatus.ts
│   │   │   └── useInterviews.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── package.json
│
├── backend/                   # Express + Prisma
│   ├── src/
│   │   ├── routes/
│   │   │   ├── applications.ts
│   │   │   ├── emailAccounts.ts
│   │   │   ├── interviews.ts
│   │   │   ├── sync.ts
│   │   │   └── settings.ts
│   │   ├── services/
│   │   │   ├── aiParser.ts        # Claude API integration
│   │   │   ├── gmailClient.ts     # Gmail API wrapper
│   │   │   ├── imapClient.ts      # IMAP client wrapper
│   │   │   ├── emailSync.ts       # sync orchestration logic
│   │   │   ├── calendarClient.ts  # Google Calendar wrapper
│   │   │   └── scheduler.ts       # node-cron jobs
│   │   ├── lib/
│   │   │   ├── prisma.ts          # Prisma client singleton
│   │   │   ├── encryption.ts      # AES-256-GCM for tokens
│   │   │   └── logger.ts          # pino logger
│   │   └── index.ts               # Express app entry point
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── data/                      # gitignored, holds jobtracker.db
│   ├── tsconfig.json
│   └── package.json
│
├── .env.example
├── .env                           # gitignored
├── .gitignore
├── ecosystem.config.js            # PM2 config
├── README.md
└── CLAUDE.md
```

---

## Environment Variables

### File: `.env.example`

```bash
# ── Anthropic ──────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...

# ── Encryption ─────────────────────────────────────────────
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
TOKEN_ENCRYPTION_KEY=

# ── Google OAuth ────────────────────────────────────────────
# Create at https://console.cloud.google.com
# Authorized redirect URIs:
#   http://localhost:3001/api/email-accounts/gmail/callback
#   http://localhost:3001/api/calendar/callback
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ── App Config ──────────────────────────────────────────────
PORT=3001
FRONTEND_URL=http://localhost:5173   # only used in dev mode
NODE_ENV=development
```

Note: In production (after pnpm build), the frontend is served as static files by the
backend on port 3001. FRONTEND_URL is only relevant during local development where the
Vite dev server runs separately on port 5173.

---

## Phase 1 — Project Scaffold

### 1.1 Root setup

```bash
mkdir job-tracker && cd job-tracker
git init
pnpm init
```

Create `pnpm-workspace.yaml`:
```yaml
packages:
  - 'frontend'
  - 'backend'
```

Create root `.gitignore`:
```
node_modules/
.env
backend/data/
frontend/dist/
*.db
*.db-journal
dist/
logs/
```

### 1.2 Frontend scaffold

```bash
cd frontend
pnpm create vite . --template react-ts
pnpm install
pnpm install -D tailwindcss postcss autoprefixer
pnpm dlx tailwindcss init -p
```

Configure `tailwind.config.ts`:
```ts
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

Add Tailwind directives to `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Install shadcn/ui:
```bash
pnpm dlx shadcn-ui@latest init
```
Select: TypeScript, Default style, CSS variables, src/components/ui path.

Add required components:
```bash
pnpm dlx shadcn-ui@latest add button card badge table dialog form input
pnpm dlx shadcn-ui@latest add label toast select textarea separator
pnpm dlx shadcn-ui@latest add dropdown-menu sheet skeleton tabs
```

Install additional frontend dependencies:
```bash
pnpm install @tanstack/react-query axios react-router-dom
pnpm install react-big-calendar date-fns
pnpm install -D @types/react-big-calendar
```

Update `vite.config.ts` to proxy API calls during development:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
```

### 1.3 Backend scaffold

```bash
cd ../backend
pnpm init
pnpm install express cors helmet morgan
pnpm install @anthropic-ai/sdk googleapis imapflow nodemailer node-cron
pnpm install @prisma/client prisma
pnpm install pino pino-pretty dotenv
pnpm install -D typescript tsx ts-node-dev
pnpm install -D @types/express @types/cors @types/morgan
pnpm install -D @types/nodemailer @types/node-cron @types/node
```

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*", "prisma/seed.ts"],
  "exclude": ["node_modules", "dist"]
}
```

Add scripts to `backend/package.json`:
```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "prisma studio"
  }
}
```

Create `backend/data/.gitkeep` so git tracks the directory but not its contents.

### 1.4 PM2 config

Create `ecosystem.config.js` at root:
```js
module.exports = {
  apps: [
    {
      name: 'job-tracker',
      script: './backend/dist/index.js',
      cwd: './backend',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      time: true,
    },
  ],
}
```

### 1.5 Root-level scripts

Install root devDependencies:
```bash
pnpm install -D concurrently -w
```

Root `package.json` scripts:
```json
{
  "scripts": {
    "dev": "concurrently \"cd backend && pnpm dev\" \"cd frontend && pnpm dev\"",
    "build": "cd frontend && pnpm build && cd ../backend && pnpm build",
    "start": "pm2 start ecosystem.config.js",
    "stop": "pm2 stop job-tracker",
    "setup": "cp .env.example .env && cd backend && pnpm db:migrate && pnpm db:seed"
  }
}
```

---

## Phase 2 — Database Schema

### File: `backend/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:../data/jobtracker.db"
}

model EmailAccount {
  id                   String        @id @default(cuid())
  provider             String        // "gmail" | "imap"
  label                String        // display name, e.g. "Personal Gmail"
  email                String
  accessToken          String?       // AES-256-GCM encrypted
  refreshToken         String?       // AES-256-GCM encrypted
  tokenExpiresAt       DateTime?
  imapHost             String?
  imapPort             Int?
  imapUser             String?
  imapPassword         String?       // AES-256-GCM encrypted
  imapTls              Boolean       @default(true)
  calendarConnected    Boolean       @default(false)
  calendarToken        String?       // AES-256-GCM encrypted
  calendarRefreshToken String?       // AES-256-GCM encrypted
  lastSyncedAt         DateTime?
  syncEnabled          Boolean       @default(true)
  createdAt            DateTime      @default(now())
  applications         Application[]
  syncJobs             SyncJob[]
}

model Application {
  id             String            @id @default(cuid())
  emailAccountId String?
  emailAccount   EmailAccount?     @relation(fields: [emailAccountId], references: [id], onDelete: SetNull)
  company        String
  role           String
  status         ApplicationStatus @default(APPLIED)
  emailMessageId String?           // Gmail message ID or IMAP UID, used for dedup
  emailSubject   String?
  aiConfidence   Float?            // 0.0–1.0, how confident the AI parse was
  notes          String?
  appliedAt      DateTime?
  updatedAt      DateTime          @updatedAt
  createdAt      DateTime          @default(now())
  interviews     Interview[]

  @@unique([emailAccountId, emailMessageId])
}

model Interview {
  id              String      @id @default(cuid())
  applicationId   String
  application     Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  title           String      // e.g. "Phone Screen", "Technical Round 2"
  scheduledAt     DateTime
  durationMinutes Int         @default(60)
  location        String?     // zoom link, address, or phone number
  calendarEventId String?     // Google Calendar event ID
  notes           String?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
}

model SyncJob {
  id             String       @id @default(cuid())
  emailAccountId String
  emailAccount   EmailAccount @relation(fields: [emailAccountId], references: [id], onDelete: Cascade)
  type           String       // "initial" | "incremental"
  status         SyncStatus   @default(PENDING)
  totalEmails    Int?         // total emails scanned
  parsedEmails   Int?         // emails identified as job-related
  errorMessage   String?
  startedAt      DateTime?
  completedAt    DateTime?
  createdAt      DateTime     @default(now())
}

model AppSettings {
  id                  String @id @default("singleton")
  syncIntervalMinutes Int    @default(15)
  initialSyncDays     Int    @default(90)
  aiModel             String @default("claude-sonnet-4-20250514")
}

enum ApplicationStatus {
  APPLIED
  INTERVIEWING
  OFFER
  REJECTED
  WITHDRAWN
}

enum SyncStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}
```

### Seed file: `backend/prisma/seed.ts`

The seed should:
1. Upsert the `AppSettings` singleton row with default values
2. Create one sample `EmailAccount` with provider `"demo"` (no real tokens) so the UI
   can render without a real connection
3. Create 6 sample `Application` rows spread across all statuses with realistic company
   names and role titles, linked to the demo account
4. Create 2 sample `Interview` rows linked to the INTERVIEWING applications, one
   scheduled in the future

This allows full UI development and testing before any real email account is connected.

Run:
```bash
cd backend
pnpm db:migrate   # creates backend/data/jobtracker.db and runs migration
pnpm db:generate  # generates Prisma client types
pnpm db:seed      # populates with sample data
```

---

## Phase 3 — Backend Core

### 3.1 Prisma singleton

`backend/src/lib/prisma.ts`:
```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### 3.2 Encryption utility

`backend/src/lib/encryption.ts`:

Implement using Node.js built-in `crypto` module only (no external packages).

- `encrypt(plaintext: string): string`
  — Generates a random 16-byte IV
  — Encrypts using AES-256-GCM with key from `TOKEN_ENCRYPTION_KEY`
  — Returns `iv:authTag:ciphertext` all as hex, joined with colons

- `decrypt(encrypted: string): string`
  — Splits on colons to recover IV, authTag, ciphertext
  — Decrypts and returns plaintext

Key validation: at module load time, check that `TOKEN_ENCRYPTION_KEY` is set and is
exactly 64 hex characters (32 bytes). Throw a clear startup error if not.

These functions are used for all OAuth tokens and IMAP passwords stored in SQLite.
Even as a local tool, the SQLite file could be in a shared or synced directory.

### 3.3 Logger

`backend/src/lib/logger.ts`:
```ts
import pino from 'pino'

export const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
})
```

### 3.4 Express entry point

`backend/src/index.ts`:

```ts
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

import { applicationRoutes } from './routes/applications'
import { emailAccountRoutes } from './routes/emailAccounts'
import { interviewRoutes } from './routes/interviews'
import { syncRoutes } from './routes/sync'
import { settingsRoutes } from './routes/settings'
import { startScheduler } from './services/scheduler'
import { logger } from './lib/logger'

const app = express()
const PORT = Number(process.env.PORT) || 3001

app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }))
app.use(express.json())
app.use(morgan('dev'))

app.use('/api/applications', applicationRoutes)
app.use('/api/email-accounts', emailAccountRoutes)
app.use('/api/interviews', interviewRoutes)
app.use('/api/sync', syncRoutes)
app.use('/api/settings', settingsRoutes)

// In production: serve the frontend build from the same process
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.resolve(__dirname, '../../frontend/dist')
  app.use(express.static(frontendDist))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'))
  })
}

app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`)
  startScheduler()
})
```

---

## Phase 4 — Email Account Management

### 4.1 Gmail client

`backend/src/services/gmailClient.ts`

Use the `googleapis` npm package throughout.

Implement the following functions:

**`getGmailAuthUrl(): string`**
- Creates an OAuth2 client using `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- Redirect URI: `http://localhost:${PORT}/api/email-accounts/gmail/callback`
- Scopes: `['https://www.googleapis.com/auth/gmail.readonly', 'email', 'profile']`
- Returns auth URL with `access_type: 'offline'` and `prompt: 'consent'`

**`exchangeCodeForTokens(code: string): Promise<GmailTokens>`**
- Exchanges the authorization code for tokens
- Fetches the user's email address via People API or tokeninfo endpoint
- Returns `{ accessToken, refreshToken, expiresAt, email }`

**`getAuthenticatedClient(account: EmailAccount): Promise<OAuth2Client>`**
- Builds OAuth2 client from stored (decrypted) tokens
- If `tokenExpiresAt` is within 5 minutes, calls `refreshAccessToken()`
  and updates the DB record with the new access token and expiry before returning

**`listMessageIds(auth: OAuth2Client, sinceDate: Date): Promise<string[]>`**
- Calls `gmail.users.messages.list` with query string `after:YYYY/MM/DD`
- Handles pagination using `nextPageToken` until all results are fetched
- Returns flat array of message ID strings

**`getMessageMeta(auth: OAuth2Client, messageId: string): Promise<MessageMeta>`**
- Calls `gmail.users.messages.get` with `format: 'metadata'`
  and `metadataHeaders: ['Subject', 'Date', 'From']`
- Returns `{ messageId, subject, date, from }` — does NOT fetch the body

**`getMessageBody(auth: OAuth2Client, messageId: string): Promise<string>`**
- Calls `gmail.users.messages.get` with `format: 'full'`
- Recursively walks the MIME part tree to find `text/plain` content
- Falls back to `text/html` if no plain text part exists, then strips HTML tags
- Decodes base64url encoded part data
- Truncates result to 4000 characters to limit token usage

### 4.2 IMAP client

`backend/src/services/imapClient.ts`

Use the `imapflow` package.

**`testImapConnection(config: ImapConfig): Promise<boolean>`**
- Attempts to connect and authenticate
- Returns `true` on success, `false` on failure (does not throw)
- Used to validate credentials before saving them to the database

**`listRecentMessages(config: ImapConfig, sinceDate: Date): Promise<ImapMessageMeta[]>`**
- Opens INBOX, searches for messages since `sinceDate`
- Returns array of `{ uid, subject, date, from }`

**`getMessageBody(config: ImapConfig, uid: number): Promise<string>`**
- Fetches the full RFC822 message for the given UID
- Extracts plain text content, strips HTML if necessary
- Truncates to 4000 characters

Where `ImapConfig`:
```ts
type ImapConfig = {
  host: string
  port: number
  user: string
  password: string  // already decrypted before passing in
  tls: boolean
}
```

### 4.3 Email account routes

`backend/src/routes/emailAccounts.ts`:

```
GET  /api/email-accounts
     Response: Array of {
       id, label, email, provider, lastSyncedAt, syncEnabled,
       calendarConnected,
       latestSync: { status, totalEmails, parsedEmails, completedAt, errorMessage } | null
     }

GET  /api/email-accounts/gmail/connect
     Response: { authUrl: string }

GET  /api/email-accounts/gmail/callback?code=...
     - Exchange code for tokens
     - Fetch email address from Google
     - Encrypt and save tokens to EmailAccount record
     - Create SyncJob { type: 'initial', status: 'PENDING' }
     - Fire-and-forget: syncAccount(newAccount.id, 'initial')
     - Redirect to: http://localhost:5173/settings?connected=gmail
       (use FRONTEND_URL env var, fall back to localhost:5173)

POST /api/email-accounts/imap
     Body: { label, host, port, user, password, tls }
     - Call testImapConnection first; return 400 with message if it fails
     - Encrypt password, save EmailAccount
     - Create SyncJob, fire initial sync
     Response: created EmailAccount (without password fields)

PATCH /api/email-accounts/:id
     Body: { label?, syncEnabled? }
     Response: updated EmailAccount

DELETE /api/email-accounts/:id
     - Cascade deletes all linked Applications, Interviews, SyncJobs
     - Returns 204
```

### 4.4 Calendar OAuth routes (add to same router)

```
GET  /api/calendar/connect/:accountId
     Response: { authUrl: string }
     - Scopes: ['https://www.googleapis.com/auth/calendar.events']
     - Encode accountId in OAuth `state` parameter

GET  /api/calendar/callback?code=...&state=accountId
     - Decode accountId from state
     - Exchange code for calendar tokens, encrypt and save on EmailAccount
     - Set calendarConnected = true
     - Redirect to: {FRONTEND_URL}/settings?calendar=connected
```

### 4.5 Frontend: Settings page (mailboxes section)

`frontend/src/pages/Settings.tsx`:

Render a list of connected email accounts. Each account card displays:
- Provider icon (Gmail SVG logo or generic mail icon for IMAP)
- Email address and custom label
- Last synced time as a relative string ("3 minutes ago", "never")
- Sync toggle (calls `PATCH /api/email-accounts/:id` with `syncEnabled`)
- Status indicator dot: green = last sync completed, amber = running, red = last sync failed
- "Connect Calendar" button if `calendarConnected` is false
- Delete button that opens a confirmation Dialog before calling DELETE

"Connect Gmail" button: calls `GET /api/email-accounts/gmail/connect`, redirects to returned URL.

"Connect IMAP" button: opens a Sheet with form fields for host, port, username, password, TLS
toggle. On submit, calls `POST /api/email-accounts/imap`. Display inline error if connection fails.

---

## Phase 5 — Email Sync & AI Parsing

### 5.1 AI parser

`backend/src/services/aiParser.ts`

Uses `@anthropic-ai/sdk`. Initialize the client with `process.env.ANTHROPIC_API_KEY`.

#### Subject classifier

```ts
async function isJobApplicationEmail(subject: string, from: string): Promise<boolean>
```

- Model: `claude-haiku-4-5` (fast and cheap for binary classification)
- Max tokens: 5
- System prompt: `"You are a classifier. Reply with only the word YES or NO, nothing else."`
- User prompt:
  ```
  Is this email related to a job application? Consider: application confirmations,
  interview invitations, rejection notices, offer letters, recruiter outreach,
  background check requests, or any status update about a job application.

  From: {from}
  Subject: {subject}
  ```
- Parse: `content[0].text.trim().toUpperCase() === 'YES'`

#### Full email parser

```ts
async function parseJobEmail(
  subject: string,
  body: string,
  from: string
): Promise<ParsedEmail | null>
```

Return type:
```ts
type ParsedEmail = {
  company: string
  role: string
  status: 'APPLIED' | 'INTERVIEWING' | 'OFFER' | 'REJECTED'
  interviewDate: string | null  // ISO 8601 datetime string or null
  confidence: number            // 0.0 to 1.0
}
```

- Model: `claude-sonnet-4-20250514`
- Max tokens: 300
- System prompt: instruct the model to return ONLY valid JSON, no markdown fences,
  no explanation text, matching the exact ParsedEmail schema above
- Include status decision rules in the prompt:
  - APPLIED: application received or confirmed
  - INTERVIEWING: interview scheduled, invited, or requested
  - OFFER: job offer extended
  - REJECTED: application declined, position filled, or "we've moved forward with other candidates"
  - Lower the confidence score when the email is ambiguous
- Wrap `JSON.parse` in try/catch; return `null` if parsing fails or required fields are missing
- Log the raw response text when parsing fails (for debugging)

### 5.2 Sync orchestration

`backend/src/services/emailSync.ts`

```ts
export async function syncAccount(
  accountId: string,
  type: 'initial' | 'incremental'
): Promise<void>
```

Full implementation logic:

```
1. Load EmailAccount from DB (decrypt tokens before use)
2. Load AppSettings singleton for initialSyncDays value
3. Create SyncJob { type, status: RUNNING, startedAt: now() }
4. Determine sinceDate:
     initial:     now minus settings.initialSyncDays days
     incremental: account.lastSyncedAt ?? 24 hours ago
5. Fetch message list based on provider:
     gmail: gmailClient.listMessageIds(auth, sinceDate)
     imap:  imapClient.listRecentMessages(config, sinceDate)
6. Counters: totalEmails = 0, parsedEmails = 0
7. For each message (sequential, not parallel):
   a. totalEmails++
   b. Fetch subject + from (meta only, not body)
   c. Check DB: does an Application with this emailMessageId already exist?
      If yes AND status has not changed → skip (dedup)
   d. Call aiParser.isJobApplicationEmail(subject, from)
   e. If result is false → continue to next message
   f. Fetch full message body
   g. Call aiParser.parseJobEmail(subject, body, from)
   h. If result is null → log warning, continue
   i. parsedEmails++
   j. Upsert Application:
        - Match on [emailAccountId, emailMessageId]
        - On create: set all fields from parsed result
        - On update: only update status if the new status represents a progression
          (APPLIED → INTERVIEWING → OFFER, or anything → REJECTED)
   k. If status is INTERVIEWING and interviewDate is not null:
        - Check if an Interview already exists for this applicationId near that date
          (within 2 hours, to avoid duplicates from re-syncing)
        - If not, create Interview { title: "Interview", scheduledAt: interviewDate }
   l. Wait 200ms before next iteration (rate limit buffer for Claude API)
8. Update account.lastSyncedAt = now()
9. Update SyncJob { status: COMPLETED, completedAt: now(), totalEmails, parsedEmails }
```

Error handling:
- Wrap entire function body in try/catch
- On error: update SyncJob { status: FAILED, errorMessage: err.message }
- Never let a single account failure propagate and crash the scheduler

### 5.3 Scheduler

`backend/src/services/scheduler.ts`

```ts
import cron from 'node-cron'
import { prisma } from '../lib/prisma'
import { syncAccount } from './emailSync'
import { logger } from '../lib/logger'

let currentTask: cron.ScheduledTask | null = null

export function startScheduler(): void {
  scheduleWithInterval(15)  // default; will be overridden by settings
}

export function restartScheduler(intervalMinutes: number): void {
  if (currentTask) currentTask.stop()
  scheduleWithInterval(intervalMinutes)
}

function scheduleWithInterval(minutes: number): void {
  const expression = `*/${minutes} * * * *`
  currentTask = cron.schedule(expression, async () => {
    logger.info('Scheduler: running incremental sync')
    const accounts = await prisma.emailAccount.findMany({
      where: { syncEnabled: true },
    })
    for (const account of accounts) {
      const running = await prisma.syncJob.findFirst({
        where: { emailAccountId: account.id, status: 'RUNNING' },
      })
      if (running) {
        logger.warn(`Skipping ${account.email} — sync already running`)
        continue
      }
      syncAccount(account.id, 'incremental').catch(err =>
        logger.error({ err }, `Incremental sync failed for ${account.id}`)
      )
    }
  })
  logger.info(`Scheduler: incremental sync every ${minutes} minutes`)
}
```

### 5.4 Sync routes

`backend/src/routes/sync.ts`:

```
POST /api/sync/trigger/:accountId
     - Returns 409 if a sync is already RUNNING for this account
     - Creates SyncJob (PENDING), fires syncAccount (non-blocking)
     - Returns 202 Accepted immediately

POST /api/sync/trigger-all
     - Triggers incremental sync for all syncEnabled accounts
     - Returns 202 immediately

GET  /api/sync/status
     - Returns one record per account:
       { accountId, accountEmail, status, totalEmails, parsedEmails,
         startedAt, completedAt, errorMessage }
     - Used by the frontend to poll sync progress

GET  /api/sync/history/:accountId
     - Returns last 20 SyncJob records for the given account
     - Ordered by createdAt desc
```

### 5.5 Application routes

`backend/src/routes/applications.ts`:

```
GET  /api/applications
     Query params:
       status?:    ApplicationStatus (can be repeated for multi-select)
       accountId?: string
       search?:    string (partial match on company OR role, case-insensitive)
       sortBy?:    'createdAt' | 'updatedAt' | 'company' | 'appliedAt'  (default: updatedAt)
       order?:     'asc' | 'desc'  (default: desc)
       page?:      number (default: 1)
       limit?:     number (default: 50)
     Response: { data: Application[], total: number, page: number }
     Each Application includes:
       - all scalar fields
       - emailAccount: { id, email, label, provider }
       - interviews: upcoming only (scheduledAt > now), sorted asc

GET  /api/applications/stats
     Response:
       { APPLIED: number, INTERVIEWING: number, OFFER: number,
         REJECTED: number, WITHDRAWN: number, total: number }

GET  /api/applications/:id
     Response: full Application with all Interviews (past and upcoming)

POST /api/applications
     Body: { company, role, status?, notes?, appliedAt?, emailAccountId? }
     - Used for manually entered applications (no email source required)
     - emailAccountId is optional

PATCH /api/applications/:id
     Body: { status?, notes?, company?, role?, appliedAt? }
     - Accepts any subset of fields
     - If status is set to REJECTED or WITHDRAWN: do not delete interviews,
       but log a note that future interviews may be irrelevant

DELETE /api/applications/:id
     - Deletes application and all linked Interview records
     - For each Interview with a calendarEventId: call calendarClient.deleteCalendarEvent
       (swallow errors — the event may already be gone)
     - Returns 204
```

---

## Phase 6 — Interview Calendar

### 6.1 Google Calendar service

`backend/src/services/calendarClient.ts`

**`getCalendarAuthUrl(accountId: string): string`**
- OAuth2 scopes: `['https://www.googleapis.com/auth/calendar.events']`
- Encode `accountId` as the OAuth `state` parameter (base64 or direct string)
- `access_type: 'offline'`, `prompt: 'consent'`

**`exchangeCalendarCode(code: string, accountId: string): Promise<void>`**
- Exchange code for tokens
- Encrypt tokens and save to `EmailAccount.calendarToken` and `.calendarRefreshToken`
- Set `calendarConnected = true`

**`getCalendarClient(account: EmailAccount): OAuth2Client`**
- Build OAuth2 client from decrypted calendar tokens
- Handle refresh the same way as Gmail tokens

**`createCalendarEvent(account, interview, application): Promise<string>`**
- Event summary: `"Interview — {company} ({role})"`
- Start: `interview.scheduledAt`
- End: `interview.scheduledAt + interview.durationMinutes`
- Description: `interview.notes ?? ''`
- Location: `interview.location ?? ''`
- Returns the created event's `id` (store as `calendarEventId`)

**`updateCalendarEvent(account, eventId, updates): Promise<void>`**
- Updates time, location, and/or description
- Silently ignores 404 (event was manually deleted from Google Calendar)

**`deleteCalendarEvent(account, eventId): Promise<void>`**
- Deletes the event
- Silently ignores 404

### 6.2 Interview routes

`backend/src/routes/interviews.ts`:

```
GET  /api/interviews
     Query params: from? (ISO date), to? (ISO date)
     Default range: from = now, to = now + 90 days
     Response: interviews with full application data (company, role, status)
     Sorted by scheduledAt asc

GET  /api/interviews/upcoming
     Response: next 10 interviews from now, with application data
     Used for the dashboard widget

POST /api/interviews
     Body: { applicationId, title, scheduledAt, durationMinutes?, location?, notes? }
     - Create Interview record
     - If application.emailAccount.calendarConnected:
         create Google Calendar event, store calendarEventId on interview
     - If application.status === 'APPLIED': update it to 'INTERVIEWING'
     Response: created Interview with calendarEventId if applicable

PATCH /api/interviews/:id
     Body: { title?, scheduledAt?, durationMinutes?, location?, notes? }
     - Update Interview record
     - If calendarEventId is set: update Google Calendar event
     Response: updated Interview

DELETE /api/interviews/:id
     - Delete Interview
     - If calendarEventId is set: delete Google Calendar event (swallow errors)
     - Returns 204
```

### 6.3 Frontend: Calendar page

`frontend/src/pages/Calendar.tsx`

Use `react-big-calendar` with the `date-fns` localizer.

Default to month view with week and day view toggle buttons.

Each interview event displays: company name + role + time.

Color code by application status:
- INTERVIEWING: blue
- OFFER: green
- REJECTED: gray (past interviews from rejected applications should appear muted)

Click an event to open a Sheet (side drawer) showing:
- Interview title, date/time, location, notes
- Linked application summary card (company, role, current status badge)
- Edit button: opens inline form to modify the interview
- Delete button with confirmation

Toolbar above calendar:
- "Schedule Interview" button: opens a Dialog with form fields:
  - Application selector (searchable, shows company + role in dropdown)
  - Title, date/time picker, duration selector, location, notes
  - On submit: calls `POST /api/interviews`

---

## Phase 7 — Dashboard & All Frontend Pages

### 7.1 React Query setup

`frontend/src/main.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
)
```

`frontend/src/lib/api.ts`:

Create typed wrapper functions for every backend endpoint. Each function uses `axios`
(pre-configured with `baseURL: '/api'`). Export named functions like:
- `getApplications(params)`, `getApplicationStats()`, `patchApplication(id, body)`
- `getEmailAccounts()`, `deleteEmailAccount(id)`, `connectImap(body)`
- `getInterviews(params)`, `getUpcomingInterviews()`, `createInterview(body)`
- `getSyncStatus()`, `triggerSync(accountId)`
- `getSettings()`, `patchSettings(body)`

### 7.2 Custom hooks

`frontend/src/hooks/useApplications.ts`:
- `useApplications(filters)` — React Query query with 30s stale time
- `useApplicationStats()` — React Query query, 60s stale time

`frontend/src/hooks/useSyncStatus.ts`:
- `useSyncStatus()` — polls every 10 seconds
- If any account status is `RUNNING`, reduces interval to 2 seconds
- Returns per-account sync state for the status bar

`frontend/src/hooks/useInterviews.ts`:
- `useUpcomingInterviews()` — upcoming interviews for the dashboard widget
- `useInterviewsInRange(from, to)` — for the calendar page

### 7.3 App routing

`frontend/src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// Layout wrapper with sidebar nav + sync status bar
<BrowserRouter>
  <Layout>
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/applications" element={<Applications />} />
      <Route path="/calendar" element={<Calendar />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  </Layout>
</BrowserRouter>
```

Sidebar nav links: Dashboard, Applications, Calendar, Settings.

### 7.4 Dashboard page

`frontend/src/pages/Dashboard.tsx`

**Stats row** (4 cards, data from `useApplicationStats()`):
- Total applications
- Active (APPLIED + INTERVIEWING combined)
- Upcoming interviews (count from `useUpcomingInterviews()`)
- Offers received

**Upcoming interviews widget**:
- List of next 5 interviews from `useUpcomingInterviews()`
- Each row: company name, role, formatted date + time, duration
- "View all" link to `/calendar`
- Empty state: "No upcoming interviews. Schedule one from an application."

**Recent activity**:
- Last 8 applications sorted by `updatedAt` from `useApplications({ limit: 8 })`
- Compact list rows: status badge, company, role, relative timestamp
- "View all" link to `/applications`

**Sync status bar** (persistent, fixed at top or in sidebar footer):
- One dot per connected account: green (ok), amber (syncing), red (error)
- Tooltip on hover: email address + last sync time + error if any
- "Sync now" icon button per account (calls `triggerSync(accountId)`)
- Uses `useSyncStatus()` with adaptive polling

### 7.5 Applications page

`frontend/src/pages/Applications.tsx`

**View toggle**: Table view (default) / Kanban view. Persist choice in localStorage.

**Filter bar** (sticky, above the table or columns):
- Status multi-select (checkboxes in a dropdown)
- Email account dropdown
- Search input (debounced 300ms, searches company + role)
- "Add application" button (top right)

**Table view columns**:
Company | Role | Status | Account | Applied | Updated | Actions

Status: colored Badge component.
Actions column: status quick-change dropdown, "Add interview" button, delete button.

**Kanban view**:
Four columns: Applied / Interviewing / Offer / Rejected.
Each column has a count badge in the header.
Cards show: company, role, applied date, upcoming interview date if any.
Clicking a card opens the detail drawer.
Drag-and-drop between columns is a stretch goal — implement as a basic click-to-move
dropdown on the card if drag-and-drop is complex.

**Application detail drawer** (Sheet component, slides in from right):
- Company (editable inline), role (editable inline)
- Status selector (Select component, saves on change)
- Email account label + email subject (read-only, grayed out)
- AI confidence score: small text "AI confidence: 92%" — only show if `aiConfidence` exists
- Notes textarea (auto-saves 1 second after user stops typing)
- "Schedule Interview" button that expands an inline form at the bottom of the drawer
- Interview timeline section:
  - Past interviews (grayed out): title, date
  - Upcoming interviews: title, date, location, edit + delete actions

**Add application dialog**:
Simple Dialog with fields: Company, Role, Status (default APPLIED), Notes, Applied Date.
Submits to `POST /api/applications`.

### 7.6 Settings page

`frontend/src/pages/Settings.tsx`

Two tabs: "Email Accounts" and "Preferences".

**Email Accounts tab** (covered in Phase 4.5):
- Connected accounts list
- Connect Gmail / Connect IMAP buttons

For each connected account that has `calendarConnected: false`:
Show a "Connect Google Calendar" button that calls `GET /api/calendar/connect/:accountId`
and redirects to the returned URL.

**Preferences tab**:
- Sync interval: Select dropdown (5 / 15 / 30 / 60 minutes)
- Initial sync window: Select dropdown (30 / 60 / 90 / 180 days)
- Both fields backed by `GET/PATCH /api/settings`
- Auto-save on change (no submit button needed)

**Danger zone** (bottom of page, in a red-bordered card):
- "Clear all application data" button
- Opens a Dialog requiring the user to type `DELETE` to confirm
- Calls `DELETE /api/settings/data`
- Shows success toast and refreshes application count

---

## Phase 8 — Settings Route & Scheduler Config

`backend/src/routes/settings.ts`:

```
GET  /api/settings
     Response: AppSettings { syncIntervalMinutes, initialSyncDays, aiModel }

PATCH /api/settings
     Body: { syncIntervalMinutes?, initialSyncDays? }
     - Update AppSettings
     - If syncIntervalMinutes changed: call restartScheduler(newInterval)
     Response: updated AppSettings

DELETE /api/settings/data
     Body: { confirm: string }
     - Validate confirm === "DELETE", return 400 if not
     - Delete all Interview records
     - Delete all Application records
     - Do NOT delete EmailAccount records (keep connections)
     - Do NOT delete SyncJob records (keep history)
     Response: 204
```

---

## Phase 9 — README & Developer Experience

### `README.md` contents:

#### What this is
One paragraph describing the project and its goal.

#### Prerequisites
- Node.js 20+
- pnpm 9+ (`npm install -g pnpm`)
- PM2 for background running (`npm install -g pm2`)
- A Google Cloud project (for Gmail + Calendar integration)
- An Anthropic API key (for email parsing)

#### Google Cloud Setup (step-by-step)
1. Go to console.cloud.google.com and create a new project
2. Navigate to "APIs & Services" → "Enable APIs"
3. Enable: Gmail API, Google Calendar API, People API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Application type: Web application
6. Authorized redirect URIs — add both:
   - `http://localhost:3001/api/email-accounts/gmail/callback`
   - `http://localhost:3001/api/calendar/callback`
7. Copy the Client ID and Client Secret into your `.env`

#### Installation

```bash
git clone https://github.com/your-username/job-tracker
cd job-tracker
pnpm install

# Set up environment variables
cp .env.example .env

# Generate a random encryption key and paste it into .env as TOKEN_ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Set up the database
cd backend && pnpm db:migrate && pnpm db:seed && cd ..
```

Then open `.env` and fill in `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

#### Running in development

```bash
pnpm dev
```

- Frontend dev server: http://localhost:5173
- Backend API: http://localhost:3001

#### Running in production (background process)

```bash
# Build everything
pnpm build

# Start with PM2 (runs in background, survives terminal close)
pnpm start

# Useful PM2 commands
pm2 status              # check if running
pm2 logs job-tracker    # tail logs
pm2 restart job-tracker # restart after config change
pnpm stop               # stop the process

# Auto-start on system reboot
pm2 startup             # follow the printed instructions
pm2 save
```

After starting, open http://localhost:3001 in your browser.

#### Backing up your data

All application data lives in a single file: `backend/data/jobtracker.db`.
Copy this file to back up. Restore by replacing the file while the app is stopped.

#### IMAP notes
For Gmail with IMAP: use an App Password (Google Account → Security → App Passwords).
For other providers (Outlook, Yahoo, etc.): use host `imap.provider.com`, port 993, TLS on.

#### Adding a new email account

1. Go to Settings in the app
2. Click "Connect Gmail" or "Connect IMAP"
3. The initial sync will run automatically and may take a few minutes depending on
   how many emails are in your inbox

---

## Implementation Order

```
Phase 1  Scaffold (monorepo, Vite, Express, tsconfig, PM2 config)
    ↓
Phase 2  Database schema + seed data (get Prisma + SQLite working)
    ↓
Phase 3  Backend core (Express server boots, Prisma connects, encryption works)
    ↓
Phase 4  Email account management (OAuth flow + IMAP connect working end-to-end)
    ↓
Phase 5  AI parsing + sync engine + scheduler  ← core value, test with real email
    ↓
Phase 6  Interview calendar (Google Calendar integration)
    ↓
Phase 7  Full frontend (Dashboard, Applications table/kanban, Calendar page)
    ↓
Phase 8  Settings route + scheduler restart
    ↓
Phase 9  README, empty states, loading skeletons, toast notifications, polish
```

**Hard gates:**
- Do not start Phase 5 until a real Gmail account can be connected and its message
  subjects are being fetched and printed to the console.
- Do not start Phase 7 until at least one real-world email has been parsed by
  the AI and created an Application record in the database.
- Do not write the README (Phase 9) until the full flow works end-to-end.

---

## Key Constraints & Decisions

1. **No raw email bodies stored.** Fetch, parse, discard. Only the structured result
   fields are persisted.

2. **Sequential Claude API calls during sync.** No parallel processing. Add 200ms delay
   between calls. A large initial sync (90 days of email) may take several minutes —
   this is expected and visible in the UI via SyncJob progress.

3. **Deduplication via emailMessageId.** The `@@unique([emailAccountId, emailMessageId])`
   constraint means re-syncing the same email inbox is always safe and idempotent.

4. **Two-model strategy for cost efficiency.** `claude-haiku-4-5` for the subject
   classifier (5 tokens max), `claude-sonnet-4-20250514` for the full email parse.
   The vast majority of emails are filtered out at the cheap classification step.

5. **Tokens and passwords encrypted at rest.** AES-256-GCM via Node.js built-in
   `crypto`. No third-party encryption libraries.

6. **Sync is fire-and-forget.** HTTP endpoints that trigger a sync return 202 immediately.
   Progress is tracked in `SyncJob` and polled by the frontend via `GET /api/sync/status`.

7. **Google Calendar is per-email-account, not global.** A user may connect calendar
   for one Gmail account but not another. Calendar operations always use the tokens
   stored on the specific EmailAccount linked to the application.

8. **SQLite is sufficient.** This is a single-user local tool. SQLite handles concurrent
   reads and sequential writes perfectly at this scale. Do not introduce PostgreSQL.

9. **No authentication.** The app is intended to run on a personal machine and accessed
   via localhost. Adding auth is a future enhancement, not a current requirement.
