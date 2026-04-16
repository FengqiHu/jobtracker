export type ApplicationStatus =
  | "APPLIED"
  | "INTERVIEWING"
  | "OFFER"
  | "REJECTED"
  | "WITHDRAWN"

export type SyncStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED"

export type AccountSummary = {
  id: string
  email: string
  label: string
  provider: string
}

export type Interview = {
  id: string
  applicationId: string
  title: string
  scheduledAt: string
  durationMinutes: number
  location: string | null
  notes: string | null
  calendarEventId: string | null
  createdAt: string
  updatedAt: string
  application?: Application
}

export type Application = {
  id: string
  emailAccountId: string | null
  company: string
  role: string
  status: ApplicationStatus
  emailMessageId: string | null
  emailSubject: string | null
  aiConfidence: number | null
  notes: string | null
  appliedAt: string | null
  updatedAt: string
  createdAt: string
  emailAccount?: AccountSummary | null
  interviews: Interview[]
}

export type ApplicationsResponse = {
  data: Application[]
  total: number
  page: number
}

export type ApplicationStats = Record<ApplicationStatus | "total", number>

export type EmailAccountSummary = {
  id: string
  label: string
  email: string
  provider: string
  lastSyncedAt: string | null
  syncEnabled: boolean
  calendarConnected: boolean
  latestSync: {
    status: SyncStatus
    totalEmails: number | null
    parsedEmails: number | null
    completedAt: string | null
    errorMessage: string | null
  } | null
}

export type SyncStatusRecord = {
  accountId: string
  accountEmail: string
  status: SyncStatus
  totalEmails: number | null
  parsedEmails: number | null
  startedAt: string | null
  completedAt: string | null
  errorMessage: string | null
}

export type AppSettings = {
  id: string
  syncIntervalMinutes: number
  initialSyncDays: number
  aiModel: string
}

export type InterviewRangeItem = Interview & {
  application: Application
}

export type ApplicationFilters = {
  status?: ApplicationStatus[]
  accountId?: string
  search?: string
  sortBy?: "createdAt" | "updatedAt" | "company" | "appliedAt"
  order?: "asc" | "desc"
  page?: number
  limit?: number
}
