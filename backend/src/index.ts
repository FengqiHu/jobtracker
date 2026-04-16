import cors from "cors"
import express from "express"
import helmet from "helmet"
import morgan from "morgan"
import path from "path"
import { URLSearchParams } from "url"

import "./lib/env"

import { logger } from "./lib/logger"
import { applicationRoutes } from "./routes/applications"
import { emailAccountRoutes } from "./routes/emailAccounts"
import { interviewRoutes } from "./routes/interviews"
import { settingsRoutes } from "./routes/settings"
import { syncRoutes } from "./routes/sync"
import { startScheduler } from "./services/scheduler"

export function createApp() {
  const app = express()
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173"

  app.use(helmet({ contentSecurityPolicy: false }))
  app.use(cors({ origin: process.env.FRONTEND_URL || "*" }))
  app.use(express.json())
  app.use(morgan("dev"))

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true })
  })

  const forwardOAuthCallback =
    (callbackPath: string) => (req: express.Request, res: express.Response) => {
      const entries: string[][] = Object.entries(req.query).flatMap(([key, value]) => {
        if (Array.isArray(value)) {
          return value.map((item) => [key, String(item)])
        }
        if (value == null) {
          return []
        }
        return [[key, String(value)]]
      })
      const query = new URLSearchParams(entries).toString()

      const target = new URL(callbackPath, frontendUrl)
      if (query) {
        target.search = query
      }

      res.redirect(target.toString())
    }

  app.get("/auth/google/callback", forwardOAuthCallback("/auth/google/callback"))
  app.get(
    "/auth/microsoft/callback",
    forwardOAuthCallback("/auth/microsoft/callback")
  )

  app.use("/api", emailAccountRoutes)
  app.use("/api", applicationRoutes)
  app.use("/api", interviewRoutes)
  app.use("/api", syncRoutes)
  app.use("/api", settingsRoutes)

  if (process.env.NODE_ENV === "production") {
    const frontendDist = path.resolve(__dirname, "../../frontend/dist")
    app.use(express.static(frontendDist))
    app.use((req, res, next) => {
      if (req.path.startsWith("/api")) {
        return next()
      }

      res.sendFile(path.join(frontendDist, "index.html"))
    })
  } else {
    app.use((req, res, next) => {
      if (
        req.path.startsWith("/api") ||
        req.path.startsWith("/auth/google/callback") ||
        req.path.startsWith("/auth/microsoft/callback")
      ) {
        return next()
      }

      res.redirect(new URL(req.originalUrl, frontendUrl).toString())
    })
  }

  return app
}

export function startServer() {
  const app = createApp()
  const port = Number(process.env.PORT) || 3000

  return app.listen(port, () => {
    logger.info(`Server running on http://localhost:${port}`)
    startScheduler()
  })
}

if (require.main === module) {
  startServer()
}
