const httpMocks = require("node-mocks-http")
const { createApp } = require("../dist/index.js")

function requestApp(app, method, url) {
  return new Promise((resolve, reject) => {
    const req = httpMocks.createRequest({
      method,
      url
    })
    const res = httpMocks.createResponse({
      eventEmitter: require("events").EventEmitter
    })

    res.on("end", () => {
      resolve({
        statusCode: res.statusCode,
        body: res._getJSONData()
      })
    })

    app.handle(req, res, reject)
  })
}

async function main() {
  const app = createApp()

  const health = await requestApp(app, "GET", "/api/health")
  const settings = await requestApp(app, "GET", "/api/settings")
  const applications = await requestApp(app, "GET", "/api/applications?limit=3")
  const accounts = await requestApp(app, "GET", "/api/email-accounts")
  const upcoming = await requestApp(app, "GET", "/api/interviews/upcoming")
  const gmailConnect = await requestApp(app, "GET", "/api/email-accounts/gmail/connect")
  const calendarConnect = await requestApp(app, "GET", "/api/calendar/connect/demo-account")
  const syncStatus = await requestApp(app, "GET", "/api/sync/status")

  if (
    health.statusCode !== 200 ||
    settings.statusCode !== 200 ||
    applications.statusCode !== 200 ||
    accounts.statusCode !== 200 ||
    upcoming.statusCode !== 200 ||
    gmailConnect.statusCode !== 200 ||
    calendarConnect.statusCode !== 200 ||
    syncStatus.statusCode !== 200
  ) {
    throw new Error("One or more smoke-test endpoints returned a non-200 status")
  }

  if (!health.body.ok) {
    throw new Error("Health endpoint did not return ok=true")
  }

  if (settings.body.syncIntervalMinutes !== 15) {
    throw new Error("Unexpected settings payload")
  }

  if (!Array.isArray(applications.body.data) || applications.body.data.length < 1) {
    throw new Error("Applications endpoint did not return seeded records")
  }

  if (!Array.isArray(accounts.body) || accounts.body.length < 1) {
    throw new Error("Email accounts endpoint did not return seeded records")
  }

  if (!Array.isArray(upcoming.body)) {
    throw new Error("Upcoming interviews endpoint did not return an array")
  }

  if (typeof gmailConnect.body.authUrl !== "string" || !gmailConnect.body.authUrl.includes("accounts.google.com")) {
    throw new Error("Gmail connect endpoint did not return an auth URL")
  }

  if (
    typeof calendarConnect.body.authUrl !== "string" ||
    !calendarConnect.body.authUrl.includes("accounts.google.com")
  ) {
    throw new Error("Calendar connect endpoint did not return an auth URL")
  }

  if (!Array.isArray(syncStatus.body)) {
    throw new Error("Sync status endpoint did not return an array")
  }

  console.log(
    JSON.stringify(
      {
        health: health.body,
        settings: {
          syncIntervalMinutes: settings.body.syncIntervalMinutes,
          initialSyncDays: settings.body.initialSyncDays
        },
        applicationCount: applications.body.total,
        accountCount: accounts.body.length,
        upcomingCount: upcoming.body.length,
        syncStatusCount: syncStatus.body.length
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
