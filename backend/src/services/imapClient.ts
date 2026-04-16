import { ImapFlow } from "imapflow"
import { convert } from "html-to-text"
import { simpleParser } from "mailparser"

export type ImapConfig = {
  host: string
  port: number
  user: string
  password?: string
  accessToken?: string
  tls: boolean
}

export type ImapMessageMeta = {
  uid: number
  subject: string
  date: string
  from: string
}

export type ImapConnectionResult = {
  ok: boolean
  message?: string
}

function describeImapError(error: unknown, config: ImapConfig): string {
  const details =
    error && typeof error === "object"
      ? {
          message: "message" in error ? String(error.message ?? "") : "",
          response: "response" in error ? String(error.response ?? "") : "",
          responseText: "responseText" in error ? String(error.responseText ?? "") : "",
          serverResponseCode:
            "serverResponseCode" in error ? String(error.serverResponseCode ?? "") : "",
          authenticationFailed:
            "authenticationFailed" in error ? Boolean(error.authenticationFailed) : false
        }
      : {
          message: "",
          response: "",
          responseText: "",
          serverResponseCode: "",
          authenticationFailed: false
        }

  const combined = [
    details.message,
    details.response,
    details.responseText,
    details.serverResponseCode
  ]
    .join(" ")
    .toLowerCase()

  if (combined.includes("basicauthblocked")) {
    return "Microsoft blocked password-based IMAP sign-in for this Outlook account. This mailbox will need Microsoft OAuth support instead of a normal IMAP password."
  }

  if (config.accessToken && /outlook|office365/i.test(config.host)) {
    return "Outlook rejected the Microsoft OAuth token. Make sure your app registration includes Outlook IMAP permission and the account granted consent."
  }

  if (
    /gmail/i.test(config.host) &&
    combined.includes("application-specific password required")
  ) {
    return "Gmail requires an App Password for IMAP. Turn on Google 2-Step Verification, create an App Password, and use that in the IMAP form instead of your normal Gmail password."
  }

  if (
    /gmail/i.test(config.host) &&
    (details.authenticationFailed || combined.includes("authenticate failed"))
  ) {
    return "Gmail rejected the IMAP login. Use the Connect Gmail button for Google OAuth, or use an App Password instead of your normal Gmail password in the IMAP form."
  }

  if (details.authenticationFailed || combined.includes("authenticate failed")) {
    return "The IMAP server rejected the username or password. Double-check the credentials and make sure this mailbox allows IMAP access."
  }

  if (combined.includes("timeout") || combined.includes("econnrefused")) {
    return "Unable to reach the IMAP server. Double-check the host, port, and TLS setting."
  }

  if (/outlook|office365/i.test(config.host)) {
    return "Outlook accepted the network connection but rejected the password-based IMAP login. This mailbox likely requires Microsoft OAuth instead of a normal IMAP password."
  }

  return "Unable to connect with the provided IMAP credentials."
}

async function withClient<T>(
  config: ImapConfig,
  action: (client: ImapFlow) => Promise<T>
): Promise<T> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.tls,
    auth: {
      user: config.user,
      pass: config.password,
      accessToken: config.accessToken
    }
  })

  await client.connect()

  try {
    return await action(client)
  } finally {
    await client.logout().catch(() => undefined)
  }
}

export async function testImapConnection(config: ImapConfig): Promise<ImapConnectionResult> {
  try {
    await withClient(config, async () => true)
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      message: describeImapError(error, config)
    }
  }
}

export async function listRecentMessages(
  config: ImapConfig,
  sinceDate: Date
): Promise<ImapMessageMeta[]> {
  return withClient(config, async (client) => {
    await client.mailboxOpen("INBOX")
    const uids = await client.search({ since: sinceDate })
    if (!Array.isArray(uids) || !uids.length) {
      return []
    }
    const messages: ImapMessageMeta[] = []

    for await (const message of client.fetch(uids, {
      uid: true,
      envelope: true
    })) {
      messages.push({
        uid: message.uid,
        subject: message.envelope?.subject ?? "",
        date: message.envelope?.date?.toISOString() ?? "",
        from:
          message.envelope?.from
            ?.map((item) => item.address ?? item.name ?? "")
            .filter(Boolean)
            .join(", ") ?? ""
      })
    }

    return messages
  })
}

export async function getMessageBody(config: ImapConfig, uid: number): Promise<string> {
  return withClient(config, async (client) => {
    await client.mailboxOpen("INBOX")

    for await (const message of client.fetch(String(uid), { source: true }, { uid: true })) {
      const parsed = await simpleParser(message.source)
      const body =
        parsed.text?.trim() ||
        (parsed.html ? convert(parsed.html.toString()) : "")
      return body.slice(0, 4000)
    }

    return ""
  })
}
