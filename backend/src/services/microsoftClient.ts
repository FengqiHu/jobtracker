import type { EmailAccount } from "@prisma/client"

import "../lib/env"

import { decrypt, encrypt } from "../lib/encryption"
import { prisma } from "../lib/prisma"
import type { ImapConfig } from "./imapClient"

export type OutlookTokens = {
  accessToken: string
  refreshToken: string | null
  expiresAt: Date | null
  email: string
  label: string
}

const outlookScopes = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "https://outlook.office.com/IMAP.AccessAsUser.All"
]

function getTenantId() {
  return process.env.MICROSOFT_TENANT_ID || "common"
}

function getRedirectUrl() {
  return (
    process.env.MICROSOFT_OAUTH_REDIRECT_URI ||
    "http://localhost:3000/auth/microsoft/callback"
  )
}

function getTokenUrl() {
  return `https://login.microsoftonline.com/${getTenantId()}/oauth2/v2.0/token`
}

function getAuthorizeUrl() {
  return `https://login.microsoftonline.com/${getTenantId()}/oauth2/v2.0/authorize`
}

function assertMicrosoftConfig() {
  if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
    throw new Error(
      "MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET must be set before connecting Outlook."
    )
  }
}

function decodeBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
  return Buffer.from(padded, "base64").toString("utf8")
}

function decodeIdTokenClaims(idToken: string): Record<string, unknown> {
  const [, payload] = idToken.split(".")
  if (!payload) {
    throw new Error("Microsoft did not return a valid ID token.")
  }

  try {
    return JSON.parse(decodeBase64Url(payload)) as Record<string, unknown>
  } catch {
    throw new Error("Microsoft returned an unreadable ID token.")
  }
}

async function postTokenRequest(body: URLSearchParams) {
  assertMicrosoftConfig()

  const response = await fetch(getTokenUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  })

  const payload = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | null

  if (!response.ok) {
    const description =
      typeof payload?.error_description === "string"
        ? payload.error_description
        : typeof payload?.error === "string"
          ? payload.error
          : "Microsoft token exchange failed."
    throw new Error(description)
  }

  return payload ?? {}
}

function getAccountDetails(tokenPayload: Record<string, unknown>) {
  const idToken =
    typeof tokenPayload.id_token === "string" ? tokenPayload.id_token : ""

  if (!idToken) {
    throw new Error("Microsoft did not return account details for this Outlook sign-in.")
  }

  const claims = decodeIdTokenClaims(idToken)
  const email =
    typeof claims.email === "string" && claims.email
      ? claims.email
      : typeof claims.preferred_username === "string" && claims.preferred_username
        ? claims.preferred_username
        : typeof claims.upn === "string" && claims.upn
          ? claims.upn
          : ""
  const label =
    typeof claims.name === "string" && claims.name ? claims.name : email || "Outlook"

  if (!email) {
    throw new Error("Microsoft sign-in succeeded, but no email address was returned.")
  }

  return { email, label }
}

function getExpiresAt(expiresIn: unknown) {
  if (typeof expiresIn !== "number" && typeof expiresIn !== "string") {
    return null
  }

  const seconds = Number(expiresIn)
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null
  }

  return new Date(Date.now() + seconds * 1000)
}

export function getOutlookAuthUrl() {
  assertMicrosoftConfig()

  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID ?? "",
    response_type: "code",
    redirect_uri: getRedirectUrl(),
    response_mode: "query",
    scope: outlookScopes.join(" "),
    state: "outlook",
    prompt: "consent"
  })

  return `${getAuthorizeUrl()}?${params.toString()}`
}

export async function exchangeOutlookCodeForTokens(code: string): Promise<OutlookTokens> {
  const payload = await postTokenRequest(
    new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID ?? "",
      client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
      code,
      redirect_uri: getRedirectUrl(),
      grant_type: "authorization_code",
      scope: outlookScopes.join(" ")
    })
  )

  const accessToken =
    typeof payload.access_token === "string" ? payload.access_token : ""
  const refreshToken =
    typeof payload.refresh_token === "string" ? payload.refresh_token : null

  if (!accessToken) {
    throw new Error("Microsoft did not return an Outlook access token.")
  }

  const { email, label } = getAccountDetails(payload)

  return {
    accessToken,
    refreshToken,
    expiresAt: getExpiresAt(payload.expires_in),
    email,
    label
  }
}

async function refreshOutlookAccessToken(account: EmailAccount) {
  if (!account.refreshToken) {
    throw new Error("Outlook access expired and no refresh token is available.")
  }

  const payload = await postTokenRequest(
    new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID ?? "",
      client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
      refresh_token: decrypt(account.refreshToken),
      grant_type: "refresh_token",
      scope: outlookScopes.join(" ")
    })
  )

  const accessToken =
    typeof payload.access_token === "string" ? payload.access_token : ""
  const refreshToken =
    typeof payload.refresh_token === "string" ? payload.refresh_token : null

  if (!accessToken) {
    throw new Error("Microsoft refresh succeeded, but no Outlook access token was returned.")
  }

  await prisma.emailAccount.update({
    where: { id: account.id },
    data: {
      accessToken: encrypt(accessToken),
      refreshToken: refreshToken ? encrypt(refreshToken) : account.refreshToken,
      tokenExpiresAt: getExpiresAt(payload.expires_in) ?? account.tokenExpiresAt
    }
  })

  return accessToken
}

export async function getOutlookAccessToken(account: EmailAccount) {
  const currentToken = account.accessToken ? decrypt(account.accessToken) : ""
  const expiresSoon =
    !account.tokenExpiresAt ||
    account.tokenExpiresAt.getTime() <= Date.now() + 5 * 60 * 1000

  if (!expiresSoon && currentToken) {
    return currentToken
  }

  return refreshOutlookAccessToken(account)
}

export async function getOutlookImapConfig(account: EmailAccount): Promise<ImapConfig> {
  return {
    host: "outlook.office365.com",
    port: 993,
    user: account.email,
    accessToken: await getOutlookAccessToken(account),
    tls: true
  }
}
