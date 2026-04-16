import { ApplicationStatus, PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      syncIntervalMinutes: 15,
      initialSyncDays: 90,
      aiModel: "gpt-5.4-mini"
    },
    update: {
      syncIntervalMinutes: 15,
      initialSyncDays: 90,
      aiModel: "gpt-5.4-mini"
    }
  })

  const demoAccount = await prisma.emailAccount.upsert({
    where: { id: "demo-account" },
    create: {
      id: "demo-account",
      provider: "demo",
      label: "Demo Inbox",
      email: "demo@jobtracker.local",
      syncEnabled: false,
      lastSyncedAt: new Date(Date.now() - 1000 * 60 * 45)
    },
    update: {
      label: "Demo Inbox",
      email: "demo@jobtracker.local",
      syncEnabled: false,
      lastSyncedAt: new Date(Date.now() - 1000 * 60 * 45)
    }
  })

  await prisma.interview.deleteMany({
    where: {
      application: {
        emailAccountId: demoAccount.id
      }
    }
  })

  await prisma.application.deleteMany({
    where: { emailAccountId: demoAccount.id }
  })

  const apps = await Promise.all([
    prisma.application.create({
      data: {
        emailAccountId: demoAccount.id,
        company: "Linear",
        role: "Product Engineer",
        status: ApplicationStatus.APPLIED,
        emailMessageId: "demo-linear-application",
        emailSubject: "Application received for Product Engineer",
        aiConfidence: 0.94,
        notes: "Submitted with referral from former teammate.",
        appliedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12)
      }
    }),
    prisma.application.create({
      data: {
        emailAccountId: demoAccount.id,
        company: "Figma",
        role: "Frontend Engineer",
        status: ApplicationStatus.INTERVIEWING,
        emailMessageId: "demo-figma-screen",
        emailSubject: "Let's schedule your first round",
        aiConfidence: 0.91,
        notes: "Recruiter screen completed. Awaiting onsite loop.",
        appliedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 18)
      }
    }),
    prisma.application.create({
      data: {
        emailAccountId: demoAccount.id,
        company: "Stripe",
        role: "Infrastructure Engineer",
        status: ApplicationStatus.OFFER,
        emailMessageId: "demo-stripe-offer",
        emailSubject: "Your Stripe offer details",
        aiConfidence: 0.98,
        notes: "Offer package under review.",
        appliedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 34)
      }
    }),
    prisma.application.create({
      data: {
        emailAccountId: demoAccount.id,
        company: "Notion",
        role: "Full Stack Engineer",
        status: ApplicationStatus.REJECTED,
        emailMessageId: "demo-notion-reject",
        emailSubject: "Update on your application",
        aiConfidence: 0.93,
        notes: "Team moved forward with another candidate.",
        appliedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 22)
      }
    }),
    prisma.application.create({
      data: {
        emailAccountId: demoAccount.id,
        company: "Vercel",
        role: "Developer Experience Engineer",
        status: ApplicationStatus.WITHDRAWN,
        emailMessageId: "demo-vercel-withdraw",
        emailSubject: "Application withdrawal confirmed",
        aiConfidence: 0.87,
        notes: "Withdrew after accepting another interview process.",
        appliedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 28)
      }
    }),
    prisma.application.create({
      data: {
        emailAccountId: demoAccount.id,
        company: "Ramp",
        role: "Platform Engineer",
        status: ApplicationStatus.INTERVIEWING,
        emailMessageId: "demo-ramp-onsite",
        emailSubject: "Ramp onsite availability",
        aiConfidence: 0.89,
        notes: "Onsite prep in progress.",
        appliedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 9)
      }
    })
  ])

  const figma = apps.find((app) => app.company === "Figma")
  const ramp = apps.find((app) => app.company === "Ramp")

  if (figma && ramp) {
    await prisma.interview.createMany({
      data: [
        {
          applicationId: figma.id,
          title: "Recruiter Screen",
          scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2),
          durationMinutes: 30,
          location: "Zoom",
          notes: "Prepare portfolio walkthrough."
        },
        {
          applicationId: ramp.id,
          title: "System Design Interview",
          scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5),
          durationMinutes: 60,
          location: "Google Meet",
          notes: "Focus on distributed systems tradeoffs."
        }
      ]
    })
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
