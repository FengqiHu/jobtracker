import cron, { type ScheduledTask } from "node-cron"

import { prisma } from "../lib/prisma"
import { logger } from "../lib/logger"
import { syncAccount } from "./emailSync"

let currentTask: ScheduledTask | null = null

async function runIncrementalSync() {
  logger.info("Scheduler: running incremental sync")
  const accounts = await prisma.emailAccount.findMany({
    where: { syncEnabled: true }
  })

  for (const account of accounts) {
    const running = await prisma.syncJob.findFirst({
      where: {
        emailAccountId: account.id,
        status: "RUNNING"
      }
    })

    if (running) {
      logger.warn(`Skipping ${account.email} because a sync is already running`)
      continue
    }

    syncAccount(account.id, "incremental").catch((error) => {
      logger.error({ error, accountId: account.id }, "Incremental sync failed")
    })
  }
}

function scheduleWithInterval(minutes: number) {
  const expression = `*/${minutes} * * * *`
  currentTask = cron.schedule(expression, () => {
    void runIncrementalSync()
  })
  logger.info(`Scheduler: incremental sync every ${minutes} minutes`)
}

export function startScheduler(): void {
  scheduleWithInterval(15)

  void prisma.appSettings
    .findUnique({ where: { id: "singleton" } })
    .then((settings) => {
      if (settings && settings.syncIntervalMinutes !== 15) {
        restartScheduler(settings.syncIntervalMinutes)
      }
    })
    .catch((error) => {
      logger.warn({ error }, "Failed to load scheduler settings on startup")
    })
}

export function restartScheduler(intervalMinutes: number): void {
  if (currentTask) {
    currentTask.stop()
  }

  scheduleWithInterval(intervalMinutes)
}
