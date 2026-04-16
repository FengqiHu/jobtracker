import { ApplicationStatus } from "@prisma/client"
import { Router } from "express"

import { prisma } from "../lib/prisma"
import { deleteCalendarEvent } from "../services/calendarClient"

export const applicationRoutes = Router()

function parseStatuses(value: unknown): ApplicationStatus[] | undefined {
  if (!value) {
    return undefined
  }

  const rawValues = Array.isArray(value) ? value : [value]
  const statuses = rawValues
    .flatMap((item) => String(item).split(","))
    .map((item) => item.trim())
    .filter((item): item is ApplicationStatus =>
      ["APPLIED", "INTERVIEWING", "OFFER", "REJECTED", "WITHDRAWN"].includes(item)
    )

  return statuses.length ? statuses : undefined
}

applicationRoutes.get("/applications", async (req, res) => {
  const page = Math.max(Number(req.query.page ?? 1), 1)
  const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 100)
  const skip = (page - 1) * limit
  const order = req.query.order === "asc" ? "asc" : "desc"
  const sortBy = ["createdAt", "updatedAt", "company", "appliedAt"].includes(
    String(req.query.sortBy)
  )
    ? String(req.query.sortBy)
    : "updatedAt"
  const statuses = parseStatuses(req.query.status)
  const search = String(req.query.search ?? "").trim()
  const accountId = String(req.query.accountId ?? "").trim()

  const where = {
    ...(statuses ? { status: { in: statuses } } : {}),
    ...(accountId ? { emailAccountId: accountId } : {}),
    ...(search
      ? {
          OR: [
            { company: { contains: search } },
            { role: { contains: search } }
          ]
        }
      : {})
  }

  const [data, total] = await Promise.all([
    prisma.application.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: order
      } as never,
      include: {
        emailAccount: {
          select: {
            id: true,
            email: true,
            label: true,
            provider: true
          }
        },
        interviews: {
          where: {
            scheduledAt: {
              gt: new Date()
            }
          },
          orderBy: {
            scheduledAt: "asc"
          }
        }
      }
    }),
    prisma.application.count({ where })
  ])

  res.json({ data, total, page })
})

applicationRoutes.get("/applications/stats", async (_req, res) => {
  const [applications] = await Promise.all([
    prisma.application.groupBy({
      by: ["status"],
      _count: {
        status: true
      }
    })
  ])

  const stats = {
    APPLIED: 0,
    INTERVIEWING: 0,
    OFFER: 0,
    REJECTED: 0,
    WITHDRAWN: 0,
    total: 0
  }

  for (const row of applications) {
    stats[row.status] = row._count.status
    stats.total += row._count.status
  }

  res.json(stats)
})

applicationRoutes.get("/applications/:id", async (req, res) => {
  const application = await prisma.application.findUnique({
    where: { id: req.params.id },
    include: {
      emailAccount: {
        select: {
          id: true,
          label: true,
          email: true,
          provider: true
        }
      },
      interviews: {
        orderBy: {
          scheduledAt: "asc"
        }
      },
      emailHistory: {
        orderBy: {
          receivedAt: "asc"
        }
      }
    }
  })

  if (!application) {
    return res.status(404).json({ message: "Application not found" })
  }

  return res.json(application)
})

applicationRoutes.post("/applications", async (req, res) => {
  const application = await prisma.application.create({
    data: {
      company: req.body.company,
      role: req.body.role,
      status: req.body.status ?? "APPLIED",
      notes: req.body.notes,
      appliedAt: req.body.appliedAt ? new Date(req.body.appliedAt) : undefined,
      emailAccountId: req.body.emailAccountId
    }
  })

  res.status(201).json(application)
})

applicationRoutes.patch("/applications/:id", async (req, res) => {
  const current = await prisma.application.findUnique({
    where: { id: req.params.id },
    include: {
      interviews: {
        where: {
          scheduledAt: {
            gt: new Date()
          }
        }
      }
    }
  })

  if (!current) {
    return res.status(404).json({ message: "Application not found" })
  }

  let notes = req.body.notes ?? current.notes ?? ""
  const nextStatus = req.body.status as ApplicationStatus | undefined

  if (nextStatus && ["REJECTED", "WITHDRAWN"].includes(nextStatus) && current.interviews.length) {
    const suffix = `[System ${new Date().toISOString()}] Future interviews may now be irrelevant.`
    notes = notes ? `${notes}\n\n${suffix}` : suffix
  }

  const application = await prisma.application.update({
    where: { id: req.params.id },
    data: {
      company: req.body.company,
      role: req.body.role,
      status: nextStatus,
      notes,
      appliedAt: req.body.appliedAt ? new Date(req.body.appliedAt) : undefined
    }
  })

  return res.json(application)
})

applicationRoutes.delete("/applications/:id", async (req, res) => {
  const application = await prisma.application.findUnique({
    where: { id: req.params.id },
    include: {
      emailAccount: true,
      interviews: true
    }
  })

  if (!application) {
    return res.status(404).json({ message: "Application not found" })
  }

  for (const interview of application.interviews) {
    if (interview.calendarEventId && application.emailAccount?.calendarConnected) {
      await deleteCalendarEvent(application.emailAccount, interview.calendarEventId).catch(
        () => undefined
      )
    }
  }

  await prisma.application.delete({
    where: { id: application.id }
  })

  return res.status(204).send()
})
