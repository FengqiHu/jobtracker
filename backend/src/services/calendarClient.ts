import { google } from "googleapis"

import type { Application, EmailAccount, Interview } from "@prisma/client"

import { decrypt, encrypt } from "../lib/encryption"
import { prisma } from "../lib/prisma"

function getRedirectUrl() {
  return (
    process.env.GOOGLE_OAUTH_REDIRECT_URI ||
    "http://localhost:3000/auth/google/callback"
  )
}

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getRedirectUrl()
  )
}

function encodeCalendarState(accountId: string) {
  return `calendar:${accountId}`
}

export function parseCalendarState(state: string): string {
  if (state.startsWith("calendar:")) {
    return state.slice("calendar:".length)
  }

  try {
    const decoded = Buffer.from(state, "base64").toString("utf8")
    if (decoded.startsWith("calendar:")) {
      return decoded.slice("calendar:".length)
    }

    return decoded || state
  } catch {
    return state
  }
}

export function getCalendarAuthUrl(accountId: string): string {
  const client = getOAuthClient()
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar.events"],
    state: encodeCalendarState(accountId)
  })
}

export async function exchangeCalendarCode(
  code: string,
  accountId: string
): Promise<void> {
  const client = getOAuthClient()
  const { tokens } = await client.getToken(code)

  await prisma.emailAccount.update({
    where: { id: accountId },
    data: {
      calendarConnected: true,
      calendarToken: tokens.access_token ? encrypt(tokens.access_token) : undefined,
      calendarRefreshToken: tokens.refresh_token
        ? encrypt(tokens.refresh_token)
        : undefined
    }
  })
}

export async function getCalendarClient(account: EmailAccount) {
  const client = getOAuthClient()
  client.setCredentials({
    access_token: account.calendarToken ? decrypt(account.calendarToken) : undefined,
    refresh_token: account.calendarRefreshToken
      ? decrypt(account.calendarRefreshToken)
      : undefined
  })

  if (account.calendarRefreshToken) {
    const refreshed = await client.refreshAccessToken().catch(() => null)

    if (refreshed?.credentials.access_token) {
      await prisma.emailAccount.update({
        where: { id: account.id },
        data: {
          calendarToken: encrypt(refreshed.credentials.access_token)
        }
      })
      client.setCredentials(refreshed.credentials)
    }
  }

  return client
}

export async function createCalendarEvent(
  account: EmailAccount,
  interview: Interview,
  application: Application
): Promise<string> {
  const auth = await getCalendarClient(account)
  const calendar = google.calendar({ version: "v3", auth })

  const response = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: `Interview — ${application.company} (${application.role})`,
      start: { dateTime: interview.scheduledAt.toISOString() },
      end: {
        dateTime: new Date(
          interview.scheduledAt.getTime() + interview.durationMinutes * 60_000
        ).toISOString()
      },
      description: interview.notes ?? "",
      location: interview.location ?? ""
    }
  })

  return response.data.id ?? ""
}

export async function updateCalendarEvent(
  account: EmailAccount,
  eventId: string,
  updates: Partial<Pick<Interview, "scheduledAt" | "durationMinutes" | "location" | "notes" | "title">>,
  application?: Application
): Promise<void> {
  const auth = await getCalendarClient(account)
  const calendar = google.calendar({ version: "v3", auth })

  try {
    await calendar.events.patch({
      calendarId: "primary",
      eventId,
      requestBody: {
        summary: application ? `Interview — ${application.company} (${application.role})` : updates.title,
        start: updates.scheduledAt
          ? { dateTime: updates.scheduledAt.toISOString() }
          : undefined,
        end:
          updates.scheduledAt && updates.durationMinutes
            ? {
                dateTime: new Date(
                  updates.scheduledAt.getTime() + updates.durationMinutes * 60_000
                ).toISOString()
              }
            : undefined,
        location: updates.location,
        description: updates.notes
      }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes("404")) {
      throw error
    }
  }
}

export async function deleteCalendarEvent(
  account: EmailAccount,
  eventId: string
): Promise<void> {
  const auth = await getCalendarClient(account)
  const calendar = google.calendar({ version: "v3", auth })

  try {
    await calendar.events.delete({
      calendarId: "primary",
      eventId
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes("404")) {
      throw error
    }
  }
}
