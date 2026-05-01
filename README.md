# Job Tracker

A web application that automatically tracks your job applications by connecting to your email accounts and using AI to extract company names, roles, and application statuses from emails.

Connect Gmail or IMAP, and Job Tracker will scan your inbox, identify job-related emails, and keep your application pipeline up to date — automatically.

---

## Features

- **AI-powered email parsing** — scans your inbox and extracts company, role, and application status from emails
- **Multiple email providers** — Gmail (OAuth2) and IMAP (with Microsoft/Outlook XOAUTH2 support)
- **Application pipeline** — track applications across statuses: Applied, Interviewing, Offer, Rejected, Withdrawn
- **Interview calendar** — schedule interviews with Google Calendar sync
- **Kanban & table views** — visualize your pipeline your way
- **Automatic sync** — background email sync on a configurable interval (default: 15 minutes)
- **Authentication** — username/password or Google login

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vite + React 19 + TypeScript |
| Styling | Tailwind CSS + shadcn/ui (Radix UI) |
| Backend | Node.js + Express 5 + TypeScript |
| ORM | Prisma |
| Database | SQLite |
| AI | OpenAI API |
| Email | Gmail API (OAuth2), IMAP (imapflow) |
| Calendar | Google Calendar API |
| Scheduler | node-cron |

---

## Prerequisites

- **Node.js 20+**
- **pnpm** (`npm install -g pnpm`)
- An **OpenAI API key**
- A **Google Cloud project** (for Gmail and/or Google Calendar integration)
- A **Microsoft Azure app registration** (optional, for Outlook OAuth)

---

## Google Cloud Setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a new project
2. Navigate to **APIs & Services → Enable APIs** and enable:
   - Gmail API
   - Google Calendar API
   - Google People API
3. Go to **Credentials → Create Credentials → OAuth 2.0 Client ID**
4. Application type: **Web application**
5. Add these **Authorized redirect URIs**:
   ```
   http://localhost:3000/auth/google/callback
   http://localhost:3000/auth/user/google/callback
   ```
6. Copy the **Client ID** and **Client Secret** into your `.env`

---

## Installation

```bash
git clone https://github.com/your-username/job-tracker
cd job-tracker
pnpm install
```

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Generate a random encryption key for stored tokens:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the output as `TOKEN_ENCRYPTION_KEY` in `.env`. Also generate a separate value for `JWT_SECRET` using the same command.

Set up the database:

```bash
cd backend
npm run db:migrate   # creates data/jobtracker.db and runs migrations
npm run db:seed      # populates with sample data
cd ..
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key for email classification and parsing |
| `TOKEN_ENCRYPTION_KEY` | 64-character hex string (32 bytes) for encrypting stored OAuth tokens |
| `JWT_SECRET` | Secret for signing JWT session tokens |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_OAUTH_REDIRECT_URI` | `http://localhost:3000/auth/google/callback` |
| `GOOGLE_USER_AUTH_REDIRECT_URI` | `http://localhost:3000/auth/user/google/callback` |
| `MICROSOFT_CLIENT_ID` | Azure app client ID (optional, for Outlook) |
| `MICROSOFT_CLIENT_SECRET` | Azure app client secret (optional) |
| `MICROSOFT_TENANT_ID` | Azure tenant ID, default `common` |
| `MICROSOFT_OAUTH_REDIRECT_URI` | `http://localhost:3000/auth/microsoft/callback` |
| `DATABASE_URL` | SQLite path, default `file:./data/jobtracker.db` |
| `PORT` | Backend port, default `3000` |
| `FRONTEND_URL` | Frontend origin, default `http://localhost:5173` (dev only) |
| `NODE_ENV` | `development` or `production` |

---

## Running in Development

```bash
pnpm dev
```

- Frontend dev server: [http://localhost:5173](http://localhost:5173)
- Backend API: [http://localhost:3000](http://localhost:3000)

---

## Running in Production (PM2)

```bash
# Build frontend and backend
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

After starting, open [http://localhost:3000](http://localhost:3000).

---

## Deployment

The project includes configuration for deploying to **Railway** (backend) and **Vercel** (frontend).

### Railway (backend)

1. Create a new Railway project and link to this repository
2. Set the root directory to `backend/`
3. Add all environment variables from `.env` (set `DATABASE_URL` to a Railway-provided persistent volume path)
4. Railway will use `railway.json` to build and start the server automatically

### Vercel (frontend)

1. Import the repository into Vercel and set the root directory to `frontend/`
2. Set the `VITE_API_URL` environment variable to your Railway backend URL
3. Vercel will use `vercel.json` for SPA routing rewrites

---

## Connecting Email Accounts

After logging in, go to **Settings → Email Accounts**.

**Gmail**
1. Click **Connect Gmail**
2. Sign in with Google and grant read access to Gmail
3. An initial sync will start automatically (may take a few minutes for large inboxes)

**IMAP (Outlook, Yahoo, etc.)**
1. Click **Connect IMAP**
2. Enter your host, port, username, and password
3. For Gmail via IMAP: use an [App Password](https://myaccount.google.com/apppasswords) (not your regular password)
4. For Outlook: use `outlook.office365.com`, port `993`, TLS on

**Microsoft / Outlook OAuth**
1. Click **Connect Microsoft Account**
2. Sign in with your Microsoft account to grant IMAP access via XOAUTH2

---

## Backing Up Your Data

All application data lives in a single file: `backend/data/jobtracker.db`.

```bash
# Backup
cp backend/data/jobtracker.db ~/jobtracker-backup.db

# Restore (while app is stopped)
cp ~/jobtracker-backup.db backend/data/jobtracker.db
```

---

## Project Structure

```
job-tracker/
├── frontend/                  # Vite + React app
│   └── src/
│       ├── components/        # UI components (shadcn/ui + custom)
│       ├── pages/             # Dashboard, Applications, Calendar, Settings
│       ├── hooks/             # React Query hooks
│       └── lib/               # Typed API wrappers
│
├── backend/                   # Express + Prisma
│   ├── src/
│   │   ├── routes/            # REST API routes
│   │   ├── services/          # AI parser, email sync, Gmail/IMAP/calendar clients
│   │   └── lib/               # Prisma client, encryption, logger, auth
│   └── prisma/
│       ├── schema.prisma
│       ├── seed.ts
│       └── migrate.ts
│
├── ecosystem.config.js        # PM2 config
├── railway.json               # Railway deployment config
└── .env.example
```
