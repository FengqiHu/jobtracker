import { Router } from "express"

import { encrypt } from "../lib/encryption"
import { logger } from "../lib/logger"
import { prisma } from "../lib/prisma"
import {
  exchangeCalendarCode,
  getCalendarAuthUrl,
  listCalendarEvents,
  parseCalendarState
} from "../services/calendarClient"
import { syncAccount } from "../services/emailSync"
import { exchangeCodeForTokens, getGmailAuthUrl } from "../services/gmailClient"
import { testImapConnection } from "../services/imapClient"
import {
  exchangeOutlookCodeForTokens,
  getOutlookAuthUrl
} from "../services/microsoftClient"

export const emailAccountRoutes = Router()

function frontendUrl(path: string) {
  const base = process.env.FRONTEND_URL || "http://localhost:5173"
  return `${base}${path}`
}

function serializeAccountSummary(account: {
  id: string
  label: string
  email: string
  provider: string
  lastSyncedAt: Date | null
  syncEnabled: boolean
  calendarConnected: boolean
}) {
  return {
    id: account.id,
    label: account.label,
    email: account.email,
    provider: account.provider,
    lastSyncedAt: account.lastSyncedAt,
    syncEnabled: account.syncEnabled,
    calendarConnected: account.calendarConnected
  }
}

async function queueInitialSync(accountId: string) {
  const job = await prisma.syncJob.create({
    data: {
      emailAccountId: accountId,
      type: "initial",
      status: "PENDING"
    }
  })

  syncAccount(accountId, "initial", job.id).catch((error) => {
    logger.error({ error, accountId }, "Initial mailbox sync failed")
  })
}

async function upsertOAuthAccount(data: {
  provider: string
  label: string
  email: string
  accessToken: string
  refreshToken?: string | null
  expiresAt?: Date | null
}) {
  const existing = await prisma.emailAccount.findFirst({
    where: {
      provider: data.provider,
      email: data.email
    }
  })

  if (existing) {
    return prisma.emailAccount.update({
      where: { id: existing.id },
      data: {
        label: data.label,
        accessToken: encrypt(data.accessToken),
        refreshToken: data.refreshToken ? encrypt(data.refreshToken) : existing.refreshToken,
        tokenExpiresAt: data.expiresAt ?? existing.tokenExpiresAt,
        syncEnabled: true
      }
    })
  }

  return prisma.emailAccount.create({
    data: {
      provider: data.provider,
      label: data.label,
      email: data.email,
      accessToken: encrypt(data.accessToken),
      refreshToken: data.refreshToken ? encrypt(data.refreshToken) : undefined,
      tokenExpiresAt: data.expiresAt ?? undefined
    }
  })
}

async function connectGmailAccount(code: string) {
  const tokens = await exchangeCodeForTokens(code)
  const account = await upsertOAuthAccount({
    provider: "gmail",
    label: tokens.email,
    email: tokens.email,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt
  })

  await queueInitialSync(account.id)

  return serializeAccountSummary(account)
}

async function connectOutlookAccount(code: string) {
  const tokens = await exchangeOutlookCodeForTokens(code)
  const validation = await testImapConnection({
    host: "outlook.office365.com",
    port: 993,
    user: tokens.email,
    accessToken: tokens.accessToken,
    tls: true
  })

  if (!validation.ok) {
    throw new Error(
      validation.message ??
        "Outlook OAuth succeeded, but the mailbox could not be opened over IMAP."
    )
  }

  const account = await upsertOAuthAccount({
    provider: "outlook",
    label: tokens.label,
    email: tokens.email,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt
  })

  await queueInitialSync(account.id)

  return serializeAccountSummary(account)
}

emailAccountRoutes.get("/email-accounts", async (_req, res) => {
  const accounts = await prisma.emailAccount.findMany({
    orderBy: {
      createdAt: "asc"
    }
  })

  const payload = await Promise.all(
    accounts.map(async (account) => {
      const latestSync = await prisma.syncJob.findFirst({
        where: { emailAccountId: account.id },
        orderBy: {
          createdAt: "desc"
        }
      })

      return {
        id: account.id,
        label: account.label,
        email: account.email,
        provider: account.provider,
        lastSyncedAt: account.lastSyncedAt,
        syncEnabled: account.syncEnabled,
        calendarConnected: account.calendarConnected,
        latestSync: latestSync
          ? {
              status: latestSync.status,
              totalEmails: latestSync.totalEmails,
              parsedEmails: latestSync.parsedEmails,
              completedAt: latestSync.completedAt,
              errorMessage: latestSync.errorMessage
            }
          : null
      }
    })
  )

  res.json(payload)
})

emailAccountRoutes.get("/email-accounts/gmail/connect", (_req, res) => {
  res.json({ authUrl: getGmailAuthUrl() })
})

emailAccountRoutes.get("/email-accounts/outlook/connect", (_req, res) => {
  try {
    res.json({ authUrl: getOutlookAuthUrl() })
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Unable to start Outlook connection"
    })
  }
})

emailAccountRoutes.post("/email-accounts/gmail/exchange", async (req, res) => {
  const code = String(req.body.code ?? "")
  if (!code) {
    return res.status(400).json({ message: "Missing Google OAuth code" })
  }

  const account = await connectGmailAccount(code)
  return res.status(201).json(account)
})

emailAccountRoutes.post("/email-accounts/outlook/exchange", async (req, res) => {
  const code = String(req.body.code ?? "")
  if (!code) {
    return res.status(400).json({ message: "Missing Microsoft OAuth code" })
  }

  try {
    const account = await connectOutlookAccount(code)
    return res.status(201).json(account)
  } catch (error) {
    return res.status(400).json({
      message: error instanceof Error ? error.message : "Unable to connect Outlook account"
    })
  }
})

emailAccountRoutes.get("/email-accounts/gmail/callback", async (req, res) => {
  const code = String(req.query.code ?? "")
  if (!code) {
    return res.redirect(frontendUrl("/settings?connected=gmail-error"))
  }

  await connectGmailAccount(code)
  return res.redirect(frontendUrl("/settings?connected=gmail"))
})

emailAccountRoutes.post("/email-accounts/imap", async (req, res) => {
  const config = {
    host: req.body.host,
    port: Number(req.body.port),
    user: req.body.user,
    password: req.body.password,
    tls: req.body.tls ?? true
  }

  const validation = await testImapConnection(config)
  if (!validation.ok) {
    return res.status(400).json({
      message: validation.message ?? "Unable to connect with the provided IMAP credentials"
    })
  }

  const account = await prisma.emailAccount.create({
    data: {
      provider: "imap",
      label: req.body.label,
      email: req.body.user,
      imapHost: config.host,
      imapPort: config.port,
      imapUser: config.user,
      imapPassword: encrypt(config.password),
      imapTls: config.tls
    }
  })

  await queueInitialSync(account.id)

  return res.status(201).json(serializeAccountSummary(account))
})

emailAccountRoutes.patch("/email-accounts/:id", async (req, res) => {
  const updated = await prisma.emailAccount.update({
    where: { id: req.params.id },
    data: {
      label: req.body.label,
      syncEnabled: req.body.syncEnabled
    }
  })

  res.json(serializeAccountSummary(updated))
})

emailAccountRoutes.delete("/email-accounts/:id", async (req, res) => {
  const account = await prisma.emailAccount.findUnique({
    where: { id: req.params.id },
    include: {
      applications: {
        include: {
          interviews: true
        }
      }
    }
  })

  if (!account) {
    return res.status(404).json({ message: "Email account not found" })
  }

  const applicationIds = account.applications.map((application) => application.id)

  if (applicationIds.length) {
    await prisma.interview.deleteMany({
      where: {
        applicationId: {
          in: applicationIds
        }
      }
    })

    await prisma.application.deleteMany({
      where: {
        id: {
          in: applicationIds
        }
      }
    })
  }

  await prisma.syncJob.deleteMany({
    where: { emailAccountId: account.id }
  })

  await prisma.emailAccount.delete({
    where: { id: account.id }
  })

  return res.status(204).send()
})

emailAccountRoutes.post("/calendar/sync/:accountId", async (req, res) => {
  const account = await prisma.emailAccount.findUnique({
    where: { id: req.params.accountId }
  })

  if (!account) {
    return res.status(404).json({ message: "Account not found" })
  }

  if (!account.calendarConnected) {
    return res.status(400).json({ message: "Google Calendar not connected for this account" })
  }

  const from = new Date()
  const to = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)

  const events = await listCalendarEvents(account, from, to)

  let synced = 0
  let created = 0

  for (const event of events) {
    const scheduledAt = new Date(event.start)
    const endTime = new Date(event.end)
    const durationMinutes = Math.round((endTime.getTime() - scheduledAt.getTime()) / 60_000)

    // Update existing interview if calendarEventId matches
    const existing = await prisma.interview.findFirst({
      where: { calendarEventId: event.id }
    })

    if (existing) {
      await prisma.interview.update({
        where: { id: existing.id },
        data: {
          title: event.summary || existing.title,
          scheduledAt,
          durationMinutes: durationMinutes > 0 ? durationMinutes : existing.durationMinutes,
          location: event.location ?? existing.location,
          notes: event.description ?? existing.notes
        }
      })
      synced++
      continue
    }

    // Try to match event to an existing application by company name in the summary
    // Expected format: "Interview — Company (Role)" or any event with "interview" keyword
    const summaryLower = event.summary.toLowerCase()
    if (!summaryLower.includes("interview")) continue

    const application = await prisma.application.findFirst({
      where: {
        emailAccountId: account.id,
        status: { in: ["APPLIED", "INTERVIEWING"] }
      },
      orderBy: { updatedAt: "desc" }
    })

    // Try to match company name from event title
    const matchedApplication = await (async () => {
      const applications = await prisma.application.findMany({
        where: { emailAccountId: account.id }
      })
      return applications.find((app) =>
        event.summary.toLowerCase().includes(app.company.toLowerCase())
      ) ?? application
    })()

    if (!matchedApplication) continue

    const duplicate = await prisma.interview.findFirst({
      where: {
        applicationId: matchedApplication.id,
        scheduledAt: {
          gte: new Date(scheduledAt.getTime() - 60 * 60 * 1000),
          lte: new Date(scheduledAt.getTime() + 60 * 60 * 1000)
        }
      }
    })

    if (duplicate) continue

    await prisma.interview.create({
      data: {
        applicationId: matchedApplication.id,
        title: event.summary,
        scheduledAt,
        durationMinutes: durationMinutes > 0 ? durationMinutes : 60,
        location: event.location ?? null,
        notes: event.description ?? null,
        calendarEventId: event.id
      }
    })
    created++
  }

  return res.json({ total: events.length, synced, created })
})

emailAccountRoutes.get("/calendar/connect/:accountId", async (req, res) => {
  res.json({
    authUrl: getCalendarAuthUrl(req.params.accountId)
  })
})

emailAccountRoutes.post("/calendar/exchange", async (req, res) => {
  const code = String(req.body.code ?? "")
  const state = String(req.body.state ?? "")
  const accountId = state ? parseCalendarState(state) : String(req.body.accountId ?? "")

  if (!code || !accountId) {
    return res.status(400).json({ message: "Missing calendar OAuth exchange payload" })
  }

  await exchangeCalendarCode(code, accountId)
  return res.json({ connected: true })
})

emailAccountRoutes.get("/calendar/callback", async (req, res) => {
  const code = String(req.query.code ?? "")
  const state = String(req.query.state ?? "")
  if (!code || !state) {
    return res.redirect(frontendUrl("/settings?calendar=error"))
  }

  const accountId = parseCalendarState(state)
  await exchangeCalendarCode(code, accountId)

  return res.redirect(frontendUrl("/settings?calendar=connected"))
})
