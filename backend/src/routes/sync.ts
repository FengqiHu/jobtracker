import { Router } from "express"

import { prisma } from "../lib/prisma"
import { cancelSync, syncAccount } from "../services/emailSync"

export const syncRoutes = Router()

syncRoutes.post("/sync/trigger/:accountId", async (req, res) => {
  const type = req.body?.type === "initial" ? "initial" : "incremental"

  const running = await prisma.syncJob.findFirst({
    where: {
      emailAccountId: req.params.accountId,
      status: "RUNNING"
    }
  })

  if (running) {
    return res.status(409).json({ message: "Sync is already running for this account" })
  }

  const job = await prisma.syncJob.create({
    data: {
      emailAccountId: req.params.accountId,
      type,
      status: "PENDING"
    }
  })

  syncAccount(req.params.accountId, type, job.id).catch(() => undefined)

  return res.status(202).json({ accepted: true })
})

syncRoutes.post("/sync/trigger-all", async (_req, res) => {
  const accounts = await prisma.emailAccount.findMany({
    where: {
      syncEnabled: true
    }
  })

  for (const account of accounts) {
    const running = await prisma.syncJob.findFirst({
      where: {
        emailAccountId: account.id,
        status: "RUNNING"
      }
    })

    if (running) {
      continue
    }

    const job = await prisma.syncJob.create({
      data: {
        emailAccountId: account.id,
        type: "incremental",
        status: "PENDING"
      }
    })

    syncAccount(account.id, "incremental", job.id).catch(() => undefined)
  }

  res.status(202).json({ accepted: true })
})

syncRoutes.post("/sync/cancel/:accountId", async (req, res) => {
  cancelSync(req.params.accountId)
  res.status(202).json({ accepted: true })
})

syncRoutes.get("/sync/status", async (_req, res) => {
  const accounts = await prisma.emailAccount.findMany({
    orderBy: {
      createdAt: "asc"
    }
  })

  const status = await Promise.all(
    accounts.map(async (account) => {
      const latest = await prisma.syncJob.findFirst({
        where: { emailAccountId: account.id },
        orderBy: {
          createdAt: "desc"
        }
      })

      return {
        accountId: account.id,
        accountEmail: account.email,
        status: latest?.status ?? "PENDING",
        totalEmails: latest?.totalEmails ?? null,
        parsedEmails: latest?.parsedEmails ?? null,
        startedAt: latest?.startedAt ?? null,
        completedAt: latest?.completedAt ?? null,
        errorMessage: latest?.errorMessage ?? null
      }
    })
  )

  res.json(status)
})

syncRoutes.get("/sync/history/:accountId", async (req, res) => {
  const history = await prisma.syncJob.findMany({
    where: { emailAccountId: req.params.accountId },
    take: 20,
    orderBy: {
      createdAt: "desc"
    }
  })

  res.json(history)
})
