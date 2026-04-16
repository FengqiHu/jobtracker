import { Router } from "express"

import { prisma } from "../lib/prisma"
import { restartScheduler } from "../services/scheduler"

export const settingsRoutes = Router()

settingsRoutes.get("/settings", async (_req, res) => {
  const settings = await prisma.appSettings.findUnique({
    where: { id: "singleton" }
  })

  res.json(settings)
})

settingsRoutes.patch("/settings", async (req, res) => {
  const current = await prisma.appSettings.findUnique({
    where: { id: "singleton" }
  })

  const updated = await prisma.appSettings.update({
    where: { id: "singleton" },
    data: {
      syncIntervalMinutes: req.body.syncIntervalMinutes,
      initialSyncDays: req.body.initialSyncDays
    }
  })

  if (
    current &&
    typeof req.body.syncIntervalMinutes === "number" &&
    req.body.syncIntervalMinutes !== current.syncIntervalMinutes
  ) {
    restartScheduler(req.body.syncIntervalMinutes)
  }

  res.json(updated)
})

settingsRoutes.delete("/settings/data", async (req, res) => {
  if (req.body.confirm !== "DELETE") {
    return res.status(400).json({ message: "Confirmation must equal DELETE" })
  }

  await prisma.interview.deleteMany()
  await prisma.application.deleteMany()

  return res.status(204).send()
})
