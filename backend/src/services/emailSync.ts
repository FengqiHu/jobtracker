import { Application, ApplicationStatus, SyncStatus } from "@prisma/client"

import { prisma } from "../lib/prisma"
import { logger } from "../lib/logger"
import {
  getEmailAccountLastEmailDate,
  updateEmailAccountSyncState
} from "../lib/emailAccountSyncState"
import * as aiParser from "./aiParser"
import * as gmailClient from "./gmailClient"
import * as imapClient from "./imapClient"
import * as microsoftClient from "./microsoftClient"
import { decrypt } from "../lib/encryption"
import { isJobRelatedEmail } from "../lib/emailFilter"

// Account IDs whose running sync should be aborted at the next iteration
const cancelRequests = new Set<string>()

export function cancelSync(accountId: string) {
  cancelRequests.add(accountId)
}

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

/** Normalize a string for fuzzy matching: lowercase, collapse whitespace, strip punctuation */
function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Returns true when the AI-extracted role looks like a placeholder that means
 * "I couldn't find the role in this email". Common in rejection emails.
 */
function isGenericRole(role: string): boolean {
  const n = normalizeForMatch(role)
  if (n.length < 3) return true
  return /^(the\s+)?(position|role|job|opportunity|opening|posting)$/.test(n) ||
    /^(unknown|n a|not specified|not applicable|unspecified|various)$/.test(n)
}

/**
 * Subject patterns that indicate a calendar booking confirmation (not the original invite).
 * e.g. "Appointment booked: AI Dev Technical Interview with Israel @ Thu Apr 23..."
 */
const APPOINTMENT_SUBJECT_PATTERNS = [
  /^appointment\s+booked/i,
  /^appointment\s+confirmed/i,
  /^appointment\s+rescheduled/i,
  /^your\s+appointment/i,
  /^interview\s+scheduled/i,
  /\byour\s+interview\s+is\s+scheduled\b/i,
  /\bhas\s+been\s+scheduled\b/i,
  /^calendar\s+invite/i,
]

function isAppointmentConfirmation(subject: string): boolean {
  return APPOINTMENT_SUBJECT_PATTERNS.some((p) => p.test(subject))
}

/**
 * Fall-back matcher for appointment confirmation emails where the AI may have
 * extracted the interviewer's name instead of the company name.
 * Looks for an existing interview within a 24-hour window of the parsed date.
 */
async function findApplicationByInterviewDate(
  emailAccountId: string,
  interviewDateIso: string
): Promise<Application | null> {
  const scheduledAt = new Date(interviewDateIso)
  if (isNaN(scheduledAt.getTime())) return null

  const nearby = await prisma.interview.findFirst({
    where: {
      application: { emailAccountId },
      scheduledAt: {
        gte: new Date(scheduledAt.getTime() - 24 * 60 * 60 * 1000),
        lte: new Date(scheduledAt.getTime() + 24 * 60 * 60 * 1000)
      }
    },
    include: { application: true }
  })

  return nearby?.application ?? null
}

/**
 * Find the best matching existing Application for a newly parsed email.
 *
 * Matching strategy:
 *  1. Exact: same account + normalized company + normalized role
 *  2. Rejection fallback: if role is generic OR single match at company → use it
 *  3. Single active application at company: different emails in the same flow often
 *     describe the role differently ("Engineering" vs "Full-Stack Engineer, Backend /
 *     Integrations Engineer") — when only one non-rejected application exists at the
 *     company, link to it rather than creating a duplicate.
 *  4. Role keyword overlap: when multiple active applications exist at the company,
 *     pick the one whose role shares the most words with the parsed role.
 */
async function findMatchingApplication(
  emailAccountId: string,
  company: string,
  role: string,
  status: ApplicationStatus
): Promise<Application | null> {
  const normalizedCompany = normalizeForMatch(company)
  const normalizedRole = normalizeForMatch(role)

  const allAtAccount = await prisma.application.findMany({
    where: { emailAccountId },
    orderBy: { updatedAt: "desc" }
  })

  const companyMatches = allAtAccount.filter(
    (app) => normalizeForMatch(app.company) === normalizedCompany
  )

  if (companyMatches.length === 0) return null

  // 1. Exact role match
  const exact = companyMatches.find(
    (app) => normalizeForMatch(app.role) === normalizedRole
  )
  if (exact) return exact

  // 2. Rejection fallback
  if (status === "REJECTED") {
    if (isGenericRole(role)) {
      const nonRejected = companyMatches.filter((app) => app.status !== "REJECTED")
      return nonRejected.length > 0 ? nonRejected[0] : companyMatches[0]
    }
    if (companyMatches.length === 1) return companyMatches[0]
    const nonRejected = companyMatches.filter((app) => app.status !== "REJECTED")
    return nonRejected.length > 0 ? nonRejected[0] : companyMatches[0]
  }

  const activeApps = companyMatches.filter(
    (app) => app.status !== "REJECTED" && app.status !== "WITHDRAWN"
  )

  // 3. Single active application at company — different emails in the same hiring
  //    flow often use different role names; collapse them into one record.
  if (activeApps.length === 1) return activeApps[0]

  // 4. Role keyword overlap among multiple active applications.
  //    Use words of ≥4 characters to avoid matching on filler words.
  if (activeApps.length > 1 && normalizedRole.length > 0) {
    const queryWords = normalizedRole.split(" ").filter((w) => w.length >= 4)
    if (queryWords.length > 0) {
      const ranked = activeApps
        .map((app) => {
          const appRole = normalizeForMatch(app.role)
          const overlap = queryWords.filter((w) => appRole.includes(w)).length
          return { app, overlap }
        })
        .filter(({ overlap }) => overlap > 0)
        .sort((a, b) => b.overlap - a.overlap)
      if (ranked.length > 0) return ranked[0].app
    }
  }

  return null
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
    const lastEmailDate =
      type === "incremental" ? await getEmailAccountLastEmailDate(account.id) : null

    const syncJob =
      jobId &&
      (await prisma.syncJob
        .update({
          where: { id: jobId },
          data: {
            status: SyncStatus.RUNNING,
            startedAt: new Date(),
            errorMessage: null
          }
        })
        .catch(() => null))

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
        : lastEmailDate ??
          account.lastSyncedAt ??
          new Date(Date.now() - 24 * 60 * 60 * 1000)

    let totalEmails = 0
    let parsedEmails = 0
    let latestEmailDate: Date | null = null

    const processParsedEmail = async (
      messageId: string,
      subject: string,
      from: string,
      emailDate: Date | null,
      bodyLoader: () => Promise<string>
    ) => {
      if (cancelRequests.has(accountId)) {
        cancelRequests.delete(accountId)
        throw new Error("Sync cancelled by user")
      }

      totalEmails += 1

      if (emailDate && (!latestEmailDate || emailDate > latestEmailDate)) {
        latestEmailDate = emailDate
      }

      // Dedup: has this message already been processed for any application on this account?
      const existingEmailRecord = await prisma.applicationEmail.findFirst({
        where: { messageId, application: { emailAccountId: account.id } }
      })
      if (existingEmailRecord) return

      // Legacy dedup for applications created before ApplicationEmail was introduced
      const legacyRecord = await prisma.application.findFirst({
        where: { emailAccountId: account.id, emailMessageId: messageId }
      })
      if (legacyRecord) return

      if (!isJobRelatedEmail(subject, from)) return

      const body = await bodyLoader()
      const parsed = await aiParser.parseJobEmail(subject, body, from)

      if (!parsed) {
        logger.warn({ accountId, messageId }, "Failed to parse job email")
        return
      }

      if (parsed.confidence < 0.5) {
        logger.debug(
          { accountId, messageId, confidence: parsed.confidence },
          "Skipping low-confidence parse"
        )
        return
      }

      parsedEmails += 1

      // Find an existing application this email belongs to
      let matchedApp = await findMatchingApplication(
        account.id,
        parsed.company,
        parsed.role,
        parsed.status
      )

      // Appointment confirmation emails (e.g. "Appointment booked: ...") often have
      // the interviewer's name extracted as the company. Fall back to matching by
      // interview date so they link to the right application instead of creating a new one.
      if (
        !matchedApp &&
        parsed.status === "INTERVIEWING" &&
        parsed.interviewDate &&
        isAppointmentConfirmation(subject)
      ) {
        matchedApp = await findApplicationByInterviewDate(account.id, parsed.interviewDate)
        if (matchedApp) {
          logger.debug(
            { accountId, messageId, appId: matchedApp.id },
            "Appointment confirmation linked to existing application via interview date"
          )
        }
      }

      let targetAppId: string

      if (matchedApp) {
        // Update status only when the email represents a progression
        if (canProgress(matchedApp.status, parsed.status as Exclude<ApplicationStatus, "WITHDRAWN">)) {
          await prisma.application.update({
            where: { id: matchedApp.id },
            data: {
              status: parsed.status,
              aiConfidence: parsed.confidence
            }
          })
          logger.debug(
            { accountId, appId: matchedApp.id, from: matchedApp.status, to: parsed.status },
            "Application status progressed"
          )
        }
        targetAppId = matchedApp.id
      } else {
        // No matching application — create a new one
        const newApp = await prisma.application.create({
          data: {
            emailAccountId: account.id,
            company: parsed.company,
            role: parsed.role,
            status: parsed.status,
            emailMessageId: messageId,
            emailSubject: subject,
            aiConfidence: parsed.confidence,
            appliedAt: emailDate ?? new Date()
          }
        })
        targetAppId = newApp.id
      }

      // Record this email in the application's history
      await prisma.applicationEmail.create({
        data: {
          applicationId: targetAppId,
          messageId,
          subject,
          receivedAt: emailDate,
          provider: account.provider
        }
      })

      // Create an interview record if the email contains a scheduled date
      if (parsed.status === "INTERVIEWING" && parsed.interviewDate) {
        const scheduledAt = new Date(parsed.interviewDate)
        if (isNaN(scheduledAt.getTime())) {
          logger.warn(
            { accountId, messageId, interviewDate: parsed.interviewDate },
            "Skipping interview creation: invalid date from AI parser"
          )
        } else {
          const duplicate = await prisma.interview.findFirst({
            where: {
              applicationId: targetAppId,
              scheduledAt: {
                gte: new Date(scheduledAt.getTime() - 2 * 60 * 60 * 1000),
                lte: new Date(scheduledAt.getTime() + 2 * 60 * 60 * 1000)
              }
            }
          })

          if (!duplicate) {
            await prisma.interview.create({
              data: {
                applicationId: targetAppId,
                title: "Interview",
                scheduledAt
              }
            })
          }
        }
      }

      await sleep(200)
    }

    if (account.provider === "gmail") {
      const auth = await gmailClient.getAuthenticatedClient(account)
      const ids = await gmailClient.listMessageIds(auth, sinceDate)

      for (const messageId of ids) {
        const meta = await gmailClient.getMessageMeta(auth, messageId)
        const emailDate = meta.date ? new Date(meta.date) : null
        await processParsedEmail(messageId, meta.subject, meta.from, emailDate, () =>
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
        const emailDate = message.date ? new Date(message.date) : null
        await processParsedEmail(
          String(message.uid),
          message.subject,
          message.from,
          emailDate,
          () => imapClient.getMessageBody(config, message.uid)
        )
      }
    }

    if (account.provider === "outlook") {
      const config = await microsoftClient.getOutlookImapConfig(account)
      const messages = await imapClient.listRecentMessages(config, sinceDate)
      for (const message of messages) {
        const emailDate = message.date ? new Date(message.date) : null
        await processParsedEmail(
          String(message.uid),
          message.subject,
          message.from,
          emailDate,
          () => imapClient.getMessageBody(config, message.uid)
        )
      }
    }

    await updateEmailAccountSyncState(account.id, new Date(), latestEmailDate)

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
