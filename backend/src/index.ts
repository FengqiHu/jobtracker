import cors from "cors"
import dotenv from "dotenv"
import express from "express"
import helmet from "helmet"
import morgan from "morgan"
import path from "path"

dotenv.config({ path: path.resolve(__dirname, "../../.env") })

import { logger } from "./lib/logger"
import { applicationRoutes } from "./routes/applications"
import { emailAccountRoutes } from "./routes/emailAccounts"
import { interviewRoutes } from "./routes/interviews"
import { settingsRoutes } from "./routes/settings"
import { syncRoutes } from "./routes/sync"
import { startScheduler } from "./services/scheduler"

export function createApp() {
  const app = express()

  app.use(helmet({ contentSecurityPolicy: false }))
  app.use(cors({ origin: process.env.FRONTEND_URL || "*" }))
  app.use(express.json())
  app.use(morgan("dev"))

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true })
  })

  app.use("/api", emailAccountRoutes)
  app.use("/api", applicationRoutes)
  app.use("/api", interviewRoutes)
  app.use("/api", syncRoutes)
  app.use("/api", settingsRoutes)

  if (process.env.NODE_ENV === "production") {
    const frontendDist = path.resolve(__dirname, "../../frontend/dist")
    app.use(express.static(frontendDist))
    app.get("*", (_req, res) => {
      res.sendFile(path.join(frontendDist, "index.html"))
    })
  }

  return app
}

export function startServer() {
  const app = createApp()
  const port = Number(process.env.PORT) || 3001

  return app.listen(port, () => {
    logger.info(`Server running on http://localhost:${port}`)
    startScheduler()
  })
}

if (require.main === module) {
  startServer()
}
