import fs from "fs"
import path from "path"
import { execFileSync } from "child_process"
import { fileURLToPath } from "url"

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(currentDir, "..")
const dbPath = path.resolve(root, "data/jobtracker.db")
const migrationPath = path.resolve(
  currentDir,
  "migrations/20260415193000_init/migration.sql"
)

fs.mkdirSync(path.dirname(dbPath), { recursive: true })

const sql = fs.readFileSync(migrationPath, "utf8")
execFileSync("sqlite3", [dbPath], {
  input: sql,
  stdio: ["pipe", "inherit", "inherit"]
})

const emailAccountColumns = execFileSync("sqlite3", [dbPath, 'PRAGMA table_info("EmailAccount");'], {
  encoding: "utf8"
})

if (!emailAccountColumns.includes("|lastEmailDate|")) {
  execFileSync("sqlite3", [dbPath, 'ALTER TABLE "EmailAccount" ADD COLUMN "lastEmailDate" DATETIME'], {
    stdio: ["ignore", "inherit", "inherit"]
  })
}

// Migrate existing Application.emailMessageId records into ApplicationEmail
// Uses a SQL trick to generate unique IDs without external libs
execFileSync("sqlite3", [dbPath, `
  INSERT OR IGNORE INTO "ApplicationEmail" ("id", "applicationId", "messageId", "subject", "receivedAt", "provider", "createdAt")
  SELECT
    lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(6))),
    a."id",
    a."emailMessageId",
    COALESCE(a."emailSubject", ''),
    a."appliedAt",
    COALESCE(e."provider", 'gmail'),
    a."createdAt"
  FROM "Application" a
  LEFT JOIN "EmailAccount" e ON e."id" = a."emailAccountId"
  WHERE a."emailMessageId" IS NOT NULL;
`], { stdio: ["ignore", "inherit", "inherit"] })

console.log(`Applied migration to ${dbPath}`)
