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

console.log(`Applied migration to ${dbPath}`)
