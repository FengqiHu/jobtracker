import { Router } from "express"

import { prisma } from "../lib/prisma"
import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent
} from "../services/calendarClient"

export const interviewRoutes = Router()

interviewRoutes.get("/interviews", async (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : new Date()
  const to = req.query.to
    ? new Date(String(req.query.to))
    : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)

  const interviews = await prisma.interview.findMany({
    where: {
      scheduledAt: {
        gte: from,
        lte: to
      }
    },
    orderBy: {
      scheduledAt: "asc"
    },
    include: {
      application: true
    }
  })

  res.json(interviews)
})

interviewRoutes.get("/interviews/upcoming", async (_req, res) => {
  const interviews = await prisma.interview.findMany({
    where: {
      scheduledAt: {
        gte: new Date()
      }
    },
    take: 10,
    orderBy: {
      scheduledAt: "asc"
    },
    include: {
      application: true
    }
  })

  res.json(interviews)
})

interviewRoutes.post("/interviews", async (req, res) => {
  const application = await prisma.application.findUnique({
    where: { id: req.body.applicationId },
    include: {
      emailAccount: true
    }
  })

  if (!application) {
    return res.status(404).json({ message: "Application not found" })
  }

  let interview = await prisma.interview.create({
    data: {
      applicationId: req.body.applicationId,
      title: req.body.title,
      scheduledAt: new Date(req.body.scheduledAt),
      durationMinutes: req.body.durationMinutes ?? 60,
      location: req.body.location,
      notes: req.body.notes
    }
  })

  if (application.emailAccount?.calendarConnected) {
    const calendarEventId = await createCalendarEvent(
      application.emailAccount,
      interview,
      application
    ).catch(() => "")

    if (calendarEventId) {
      interview = await prisma.interview.update({
        where: { id: interview.id },
        data: { calendarEventId }
      })
    }
  }

  if (application.status === "APPLIED") {
    await prisma.application.update({
      where: { id: application.id },
      data: { status: "INTERVIEWING" }
    })
  }

  return res.status(201).json(interview)
})

interviewRoutes.patch("/interviews/:id", async (req, res) => {
  const existing = await prisma.interview.findUnique({
    where: { id: req.params.id },
    include: {
      application: {
        include: {
          emailAccount: true
        }
      }
    }
  })

  if (!existing) {
    return res.status(404).json({ message: "Interview not found" })
  }

  const updated = await prisma.interview.update({
    where: { id: req.params.id },
    data: {
      title: req.body.title,
      scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : undefined,
      durationMinutes: req.body.durationMinutes,
      location: req.body.location,
      notes: req.body.notes
    }
  })

  if (existing.calendarEventId && existing.application.emailAccount?.calendarConnected) {
    await updateCalendarEvent(
      existing.application.emailAccount,
      existing.calendarEventId,
      {
        title: updated.title,
        scheduledAt: updated.scheduledAt,
        durationMinutes: updated.durationMinutes,
        location: updated.location,
        notes: updated.notes
      },
      existing.application
    ).catch(() => undefined)
  }

  return res.json(updated)
})

interviewRoutes.delete("/interviews/:id", async (req, res) => {
  const existing = await prisma.interview.findUnique({
    where: { id: req.params.id },
    include: {
      application: {
        include: {
          emailAccount: true
        }
      }
    }
  })

  if (!existing) {
    return res.status(404).json({ message: "Interview not found" })
  }

  if (existing.calendarEventId && existing.application.emailAccount?.calendarConnected) {
    await deleteCalendarEvent(
      existing.application.emailAccount,
      existing.calendarEventId
    ).catch(() => undefined)
  }

  await prisma.interview.delete({
    where: { id: req.params.id }
  })

  return res.status(204).send()
})
