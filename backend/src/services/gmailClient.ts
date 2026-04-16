import { google } from "googleapis"
import type { gmail_v1 } from "googleapis"

import type { EmailAccount } from "@prisma/client"

import { decrypt, encrypt } from "../lib/encryption"
import { prisma } from "../lib/prisma"

export type GmailTokens = {
  accessToken: string
  refreshToken: string | null
  expiresAt: Date | null
  email: string
}

export type MessageMeta = {
  messageId: string
  subject: string
  date: string
  from: string
}

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

function decodeBase64Url(value: string): string {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
    "utf8"
  )
}

function extractBody(parts?: gmail_v1.Schema$MessagePart[]): string | null {
  if (!parts?.length) {
    return null
  }

  for (const part of parts) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      return decodeBase64Url(part.body.data)
    }

    if (part.parts?.length) {
      const nested = extractBody(part.parts)
      if (nested) {
        return nested
      }
    }
  }

  for (const part of parts) {
    if (part.mimeType === "text/html" && part.body?.data) {
      const html = decodeBase64Url(part.body.data)
      return html.replace(/<[^>]+>/g, " ")
    }
  }

  return null
}

export function getGmailAuthUrl(): string {
  const client = getOAuthClient()
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    state: "gmail",
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "email",
      "profile"
    ]
  })
}

export async function exchangeCodeForTokens(code: string): Promise<GmailTokens> {
  const client = getOAuthClient()
  const { tokens } = await client.getToken(code)
  client.setCredentials(tokens)

  const oauth2 = google.oauth2({
    auth: client,
    version: "v2"
  })
  const userInfo = await oauth2.userinfo.get()

  return {
    accessToken: tokens.access_token ?? "",
    refreshToken: tokens.refresh_token ?? null,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    email: userInfo.data.email ?? ""
  }
}

export async function getAuthenticatedClient(account: EmailAccount) {
  const client = getOAuthClient()
  client.setCredentials({
    access_token: account.accessToken ? decrypt(account.accessToken) : undefined,
    refresh_token: account.refreshToken ? decrypt(account.refreshToken) : undefined,
    expiry_date: account.tokenExpiresAt?.getTime()
  })

  const expiresSoon =
    !account.tokenExpiresAt ||
    account.tokenExpiresAt.getTime() <= Date.now() + 1000 * 60 * 5

  if (expiresSoon && account.refreshToken) {
    const refreshed = await client.refreshAccessToken()
    const credentials = refreshed.credentials
    client.setCredentials(credentials)

    if (credentials.access_token) {
      await prisma.emailAccount.update({
        where: { id: account.id },
        data: {
          accessToken: encrypt(credentials.access_token),
          tokenExpiresAt: credentials.expiry_date
            ? new Date(credentials.expiry_date)
            : account.tokenExpiresAt
        }
      })
    }
  }

  return client
}

export async function listMessageIds(
  auth: Awaited<ReturnType<typeof getAuthenticatedClient>>,
  sinceDate: Date
): Promise<string[]> {
  const gmail = google.gmail({ version: "v1", auth })
  const ids: string[] = []
  let pageToken: string | undefined
  const after = `${sinceDate.getFullYear()}/${String(sinceDate.getMonth() + 1).padStart(2, "0")}/${String(
    sinceDate.getDate()
  ).padStart(2, "0")}`

  do {
    const response = await gmail.users.messages.list({
      userId: "me",
      q: `after:${after}`,
      pageToken
    })

    ids.push(...(response.data.messages?.map((message) => message.id).filter(Boolean) as string[]))
    pageToken = response.data.nextPageToken ?? undefined
  } while (pageToken)

  return ids
}

export async function getMessageMeta(
  auth: Awaited<ReturnType<typeof getAuthenticatedClient>>,
  messageId: string
): Promise<MessageMeta> {
  const gmail = google.gmail({ version: "v1", auth })
  const response = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "metadata",
    metadataHeaders: ["Subject", "Date", "From"]
  })

  const headers = response.data.payload?.headers ?? []
  const getHeader = (name: string) =>
    headers.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value ?? ""

  return {
    messageId,
    subject: getHeader("Subject"),
    date: getHeader("Date"),
    from: getHeader("From")
  }
}

export async function getMessageBody(
  auth: Awaited<ReturnType<typeof getAuthenticatedClient>>,
  messageId: string
): Promise<string> {
  const gmail = google.gmail({ version: "v1", auth })
  const response = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full"
  })

  const payload = response.data.payload
  const body =
    extractBody(payload?.parts) ||
    (payload?.body?.data ? decodeBase64Url(payload.body.data) : "")

  return body.trim().slice(0, 4000)
}
