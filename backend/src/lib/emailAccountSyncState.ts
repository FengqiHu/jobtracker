import { prisma } from "./prisma"

type TableInfoRow = {
  name: string
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
