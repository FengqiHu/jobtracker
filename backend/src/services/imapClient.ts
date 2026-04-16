import { ImapFlow } from "imapflow"
import { convert } from "html-to-text"
import { simpleParser } from "mailparser"

export type ImapConfig = {
  host: string
  port: number
  user: string
  password: string
  tls: boolean
}

export type ImapMessageMeta = {
  uid: number
  subject: string
  date: string
  from: string
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
      pass: config.password
    }
  })

  await client.connect()

  try {
    return await action(client)
  } finally {
    await client.logout().catch(() => undefined)
  }
}

export async function testImapConnection(config: ImapConfig): Promise<boolean> {
  try {
    await withClient(config, async () => true)
    return true
  } catch {
    return false
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

    for await (const message of client.fetch(String(uid), { source: true })) {
      const parsed = await simpleParser(message.source)
      const body =
        parsed.text?.trim() ||
        (parsed.html ? convert(parsed.html.toString()) : "")
      return body.slice(0, 4000)
    }

    return ""
  })
}
