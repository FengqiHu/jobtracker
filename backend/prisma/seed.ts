import { PrismaClient } from "@prisma/client"

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

  const demoAccount = await prisma.emailAccount.findUnique({
    where: { id: "demo-account" }
  })

  if (demoAccount) {
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

    await prisma.syncJob.deleteMany({
      where: { emailAccountId: demoAccount.id }
    })

    await prisma.emailAccount.delete({
      where: { id: demoAccount.id }
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
