import { prisma } from "./prisma"

type TableInfoRow = {
  name: string
}

// ─── ApplicationEmail.emailAccountId ─────────────────────────────────────────
// Tracks which email account fetched a given message, independent of which
// Application it was linked to. This is necessary for correct deduplication
// when the AI cross-account matcher links an email from account B to an
// Application that belongs to account A — without this field, the next sync
// of account B would not find the existing record and reprocess the message.

let ensureApplicationEmailAccountIdPromise: Promise<void> | null = null

async function ensureApplicationEmailAccountIdInternal() {
  const columns = await prisma.$queryRawUnsafe<TableInfoRow[]>(
    'PRAGMA table_info("ApplicationEmail")'
  )
  if (columns.some((c) => c.name === "emailAccountId")) return

  try {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "ApplicationEmail" ADD COLUMN "emailAccountId" TEXT'
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes("duplicate column name")) throw error
  }
}

export async function ensureApplicationEmailSchema() {
  if (!ensureApplicationEmailAccountIdPromise) {
    ensureApplicationEmailAccountIdPromise =
      ensureApplicationEmailAccountIdInternal().catch((error) => {
        ensureApplicationEmailAccountIdPromise = null
        throw error
      })
  }
  await ensureApplicationEmailAccountIdPromise
}

/** Returns true if this (messageId, emailAccountId) pair has already been processed. */
export async function isMessageAlreadyProcessed(
  emailAccountId: string,
  messageId: string
): Promise<boolean> {
  await ensureApplicationEmailSchema()
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "ApplicationEmail"
    WHERE "messageId" = ${messageId} AND "emailAccountId" = ${emailAccountId}
    LIMIT 1
  `
  return rows.length > 0
}

/** Stamps the originating email account on an ApplicationEmail record. */
export async function stampApplicationEmailAccount(
  applicationEmailId: string,
  emailAccountId: string
): Promise<void> {
  await ensureApplicationEmailSchema()
  await prisma.$executeRaw`
    UPDATE "ApplicationEmail"
    SET "emailAccountId" = ${emailAccountId}
    WHERE "id" = ${applicationEmailId}
  `
}

type LastEmailDateRow = {
  lastEmailDate: Date | string | null
}

let ensureLastEmailDateColumnPromise: Promise<void> | null = null

function normalizeDate(value: Date | string | null | undefined) {
  if (!value) {
    return null
  }

  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

async function ensureLastEmailDateColumnInternal() {
  const columns = await prisma.$queryRawUnsafe<TableInfoRow[]>(
    'PRAGMA table_info("EmailAccount")'
  )

  if (columns.some((column) => column.name === "lastEmailDate")) {
    return
  }

  try {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "EmailAccount" ADD COLUMN "lastEmailDate" DATETIME'
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes("duplicate column name")) {
      throw error
    }
  }
}

export async function ensureEmailAccountSyncStateSchema() {
  if (!ensureLastEmailDateColumnPromise) {
    ensureLastEmailDateColumnPromise = ensureLastEmailDateColumnInternal().catch((error) => {
      ensureLastEmailDateColumnPromise = null
      throw error
    })
  }

  await ensureLastEmailDateColumnPromise
}

export async function getEmailAccountLastEmailDate(accountId: string) {
  await ensureEmailAccountSyncStateSchema()

  const rows = await prisma.$queryRaw<LastEmailDateRow[]>`
    SELECT "lastEmailDate" AS lastEmailDate
    FROM "EmailAccount"
    WHERE "id" = ${accountId}
    LIMIT 1
  `

  return normalizeDate(rows[0]?.lastEmailDate)
}

export async function updateEmailAccountSyncState(
  accountId: string,
  syncedAt: Date,
  lastEmailDate: Date | null
) {
  await ensureEmailAccountSyncStateSchema()

  if (lastEmailDate) {
    await prisma.$executeRaw`
      UPDATE "EmailAccount"
      SET "lastSyncedAt" = ${syncedAt},
          "lastEmailDate" = ${lastEmailDate}
      WHERE "id" = ${accountId}
    `
    return
  }

  await prisma.$executeRaw`
    UPDATE "EmailAccount"
    SET "lastSyncedAt" = ${syncedAt}
    WHERE "id" = ${accountId}
  `
}
