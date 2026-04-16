import { ApplicationStatus, SyncStatus } from "@prisma/client"

import { prisma } from "../lib/prisma"
import { logger } from "../lib/logger"
import * as aiParser from "./aiParser"
import * as gmailClient from "./gmailClient"
import * as imapClient from "./imapClient"
import * as microsoftClient from "./microsoftClient"
import { decrypt } from "../lib/encryption"

const statusOrder: Record<ApplicationStatus, number> = {
  APPLIED: 1,
  INTERVIEWING: 2,
  OFFER: 3,
  REJECTED: 4,
  WITHDRAWN: 0
}

function canProgress(
  current: ApplicationStatus,
  next: Exclude<ApplicationStatus, "WITHDRAWN">
): boolean {
  if (next === "REJECTED") {
    return current !== "REJECTED"
  }

  return statusOrder[next] > statusOrder[current]
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function syncAccount(
  accountId: string,
  type: "initial" | "incremental",
  syncJobId?: string
): Promise<void> {
  let jobId = syncJobId

  try {
    const account = await prisma.emailAccount.findUnique({
      where: { id: accountId }
    })

    if (!account) {
      throw new Error(`Email account ${accountId} not found`)
    }

    const settings = await prisma.appSettings.findUnique({
      where: { id: "singleton" }
    })

    const syncJob =
      jobId &&
      (await prisma.syncJob.update({
        where: { id: jobId },
        data: {
          status: SyncStatus.RUNNING,
          startedAt: new Date(),
          errorMessage: null
        }
      }).catch(() => null))

    if (!syncJob) {
      const created = await prisma.syncJob.create({
        data: {
          emailAccountId: accountId,
          type,
          status: SyncStatus.RUNNING,
          startedAt: new Date()
        }
      })
      jobId = created.id
    }

    const sinceDate =
      type === "initial"
        ? new Date(
            Date.now() - (settings?.initialSyncDays ?? 90) * 24 * 60 * 60 * 1000
          )
        : account.lastSyncedAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000)

    let totalEmails = 0
    let parsedEmails = 0

    const processParsedEmail = async (
      messageId: string,
      subject: string,
      from: string,
      bodyLoader: () => Promise<string>
    ) => {
      totalEmails += 1

      const existing = await prisma.application.findFirst({
        where: {
          emailAccountId: account.id,
          emailMessageId: messageId
        }
      })

      if (existing) {
        return
      }

      const related = await aiParser.isJobApplicationEmail(subject, from)
      if (!related) {
        return
      }

      const body = await bodyLoader()
      const parsed = await aiParser.parseJobEmail(subject, body, from)

      if (!parsed) {
        logger.warn({ accountId, messageId }, "Failed to parse job email")
        return
      }

      parsedEmails += 1

      const created = await prisma.application.create({
        data: {
          emailAccountId: account.id,
          company: parsed.company,
          role: parsed.role,
          status: parsed.status,
          emailMessageId: messageId,
          emailSubject: subject,
          aiConfidence: parsed.confidence,
          appliedAt: parsed.status === "APPLIED" ? new Date() : undefined
        }
      })

      const priorApplication = await prisma.application.findFirst({
        where: {
          id: { not: created.id },
          emailAccountId: account.id,
          company: parsed.company,
          role: parsed.role
        },
        orderBy: {
          updatedAt: "desc"
        }
      })

      if (priorApplication && canProgress(priorApplication.status, parsed.status)) {
        await prisma.application.update({
          where: { id: priorApplication.id },
          data: {
            status: parsed.status,
            emailSubject: subject,
            aiConfidence: parsed.confidence,
            notes: priorApplication.notes,
            appliedAt: priorApplication.appliedAt ?? created.appliedAt
          }
        })
      }

      if (parsed.status === "INTERVIEWING" && parsed.interviewDate) {
        const scheduledAt = new Date(parsed.interviewDate)
        const duplicate = await prisma.interview.findFirst({
          where: {
            applicationId: created.id,
            scheduledAt: {
              gte: new Date(scheduledAt.getTime() - 2 * 60 * 60 * 1000),
              lte: new Date(scheduledAt.getTime() + 2 * 60 * 60 * 1000)
            }
          }
        })

        if (!duplicate) {
          await prisma.interview.create({
            data: {
              applicationId: created.id,
              title: "Interview",
              scheduledAt
            }
          })
        }
      }

      await sleep(200)
    }

    if (account.provider === "gmail") {
      const auth = await gmailClient.getAuthenticatedClient(account)
      const ids = await gmailClient.listMessageIds(auth, sinceDate)

      for (const messageId of ids) {
        const meta = await gmailClient.getMessageMeta(auth, messageId)
        await processParsedEmail(messageId, meta.subject, meta.from, () =>
          gmailClient.getMessageBody(auth, messageId)
        )
      }
    }

    if (account.provider === "imap") {
      const config: imapClient.ImapConfig = {
        host: account.imapHost ?? "",
        port: account.imapPort ?? 993,
        user: account.imapUser ?? "",
        password: account.imapPassword ? decrypt(account.imapPassword) : "",
        tls: account.imapTls
      }

      const messages = await imapClient.listRecentMessages(config, sinceDate)
      for (const message of messages) {
        await processParsedEmail(
          String(message.uid),
          message.subject,
          message.from,
          () => imapClient.getMessageBody(config, message.uid)
        )
      }
    }

    if (account.provider === "outlook") {
      const config = await microsoftClient.getOutlookImapConfig(account)
      const messages = await imapClient.listRecentMessages(config, sinceDate)
      for (const message of messages) {
        await processParsedEmail(
          String(message.uid),
          message.subject,
          message.from,
          () => imapClient.getMessageBody(config, message.uid)
        )
      }
    }

    await prisma.emailAccount.update({
      where: { id: account.id },
      data: { lastSyncedAt: new Date() }
    })

    await prisma.syncJob.update({
      where: { id: jobId! },
      data: {
        status: SyncStatus.COMPLETED,
        completedAt: new Date(),
        totalEmails,
        parsedEmails
      }
    })
  } catch (error) {
    logger.error({ error, accountId }, "Account sync failed")

    if (jobId) {
      await prisma.syncJob.update({
        where: { id: jobId },
        data: {
          status: SyncStatus.FAILED,
          completedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : String(error)
        }
      })
    }
  }
}
