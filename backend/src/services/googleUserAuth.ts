import { google } from "googleapis"

function getRedirectUri() {
  return (
    process.env.GOOGLE_USER_AUTH_REDIRECT_URI ||
    "http://localhost:3000/auth/user/google/callback"
  )
}

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set for Google login")
  }
  return new google.auth.OAuth2(clientId, clientSecret, getRedirectUri())
}

export function getGoogleUserAuthUrl(): string {
  const client = getOAuth2Client()
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "select_account",
    scope: ["openid", "email", "profile"]
  })
}

export async function exchangeGoogleUserCode(code: string): Promise<{
  googleId: string
  email: string
  name: string
}> {
  const client = getOAuth2Client()
  const { tokens } = await client.getToken(code)

  if (!tokens.id_token) {
    throw new Error("No ID token returned from Google")
  }

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID
  })

  const payload = ticket.getPayload()
  if (!payload) throw new Error("Failed to decode Google ID token")

  return {
    googleId: payload.sub,
    email: payload.email ?? "",
    name: payload.name || payload.email || "Google User"
  }
}
