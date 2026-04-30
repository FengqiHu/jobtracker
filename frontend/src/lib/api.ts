import axios from "axios"

import type {
  Application,
  ApplicationFilters,
  ApplicationsResponse,
  ApplicationStats,
  AppSettings,
  EmailAccountSummary,
  Interview,
  InterviewRangeItem,
  SyncStatusRecord
} from "./types"

export const TOKEN_KEY = "job_tracker_token"

const api = axios.create({
  baseURL: "/api"
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith("/login") && !window.location.pathname.startsWith("/register")) {
      localStorage.removeItem(TOKEN_KEY)
      window.location.href = "/login"
    }
    return Promise.reject(error)
  }
)

export interface AuthUser {
  id: string
  username: string | null
  name: string
  email: string | null
  hasPassword: boolean
  googleLinked: boolean
}

export function login(username: string, password: string) {
  return api
    .post<{ token: string; user: AuthUser }>("/auth/login", { username, password })
    .then((r) => r.data)
}

export function register(username: string, name: string, password: string) {
  return api
    .post<{ token: string; user: AuthUser }>("/auth/register", { username, name, password })
    .then((r) => r.data)
}

export function getGoogleAuthUrl() {
  return api.get<{ authUrl: string }>("/auth/google/url").then((r) => r.data)
}

export function exchangeGoogleUserCode(code: string) {
  return api
    .post<{ token: string; user: AuthUser; usernameRequired: boolean }>(
      "/auth/google/exchange",
      { code }
    )
    .then((r) => r.data)
}

export function setUsername(username: string) {
  return api
    .patch<{ token: string; user: AuthUser }>("/auth/username", { username })
    .then((r) => r.data)
}

export function getMe() {
  return api.get<AuthUser>("/auth/me").then((r) => r.data)
}

export function getApplications(params: ApplicationFilters) {
  return api
    .get<ApplicationsResponse>("/applications", { params })
    .then((response) => response.data)
}

export function getApplication(id: string) {
  return api.get<Application>(`/applications/${id}`).then((response) => response.data)
}

export function getApplicationStats() {
  return api
    .get<ApplicationStats>("/applications/stats")
    .then((response) => response.data)
}

export function createApplication(body: {
  company: string
  role: string
  status?: string
  notes?: string
  appliedAt?: string
  emailAccountId?: string
}) {
  return api.post<Application>("/applications", body).then((response) => response.data)
}

export function patchApplication(id: string, body: Record<string, unknown>) {
  return api.patch<Application>(`/applications/${id}`, body).then((response) => response.data)
}

export function deleteApplication(id: string) {
  return api.delete(`/applications/${id}`)
}

export function getEmailAccounts() {
  return api
    .get<EmailAccountSummary[]>("/email-accounts")
    .then((response) => response.data)
}

export function getGmailConnectUrl() {
  return api
    .get<{ authUrl: string }>("/email-accounts/gmail/connect")
    .then((response) => response.data)
}

export function getOutlookConnectUrl() {
  return api
    .get<{ authUrl: string }>("/email-accounts/outlook/connect")
    .then((response) => response.data)
}

export function exchangeGmailCode(code: string) {
  return api
    .post<EmailAccountSummary>("/email-accounts/gmail/exchange", { code })
    .then((response) => response.data)
}

export function exchangeOutlookCode(code: string) {
  return api
    .post<EmailAccountSummary>("/email-accounts/outlook/exchange", { code })
    .then((response) => response.data)
}

export function connectImap(body: {
  label: string
  host: string
  port: number
  user: string
  password: string
  tls: boolean
}) {
  return api
    .post<EmailAccountSummary>("/email-accounts/imap", body)
    .then((response) => response.data)
}

export function patchEmailAccount(id: string, body: Record<string, unknown>) {
  return api
    .patch<EmailAccountSummary>(`/email-accounts/${id}`, body)
    .then((response) => response.data)
}

export function deleteEmailAccount(id: string) {
  return api.delete(`/email-accounts/${id}`)
}

export function getCalendarConnectUrl(accountId: string) {
  return api
    .get<{ authUrl: string }>(`/calendar/connect/${accountId}`)
    .then((response) => response.data)
}

export function exchangeCalendarCode(body: { code: string; state: string }) {
  return api.post<{ connected: boolean }>("/calendar/exchange", body).then((response) => response.data)
}

export function syncCalendar(accountId: string) {
  return api
    .post<{ total: number; synced: number; created: number }>(`/calendar/sync/${accountId}`)
    .then((response) => response.data)
}

export function getInterviews(params?: { from?: string; to?: string }) {
  return api
    .get<InterviewRangeItem[]>("/interviews", { params })
    .then((response) => response.data)
}

export function getUpcomingInterviews() {
  return api
    .get<InterviewRangeItem[]>("/interviews/upcoming")
    .then((response) => response.data)
}

export function createInterview(body: Record<string, unknown>) {
  return api.post<Interview>("/interviews", body).then((response) => response.data)
}

export function patchInterview(id: string, body: Record<string, unknown>) {
  return api.patch<Interview>(`/interviews/${id}`, body).then((response) => response.data)
}

export function deleteInterview(id: string) {
  return api.delete(`/interviews/${id}`)
}

export function getSyncStatus() {
  return api.get<SyncStatusRecord[]>("/sync/status").then((response) => response.data)
}

export function triggerSync(accountId: string) {
  return api.post(`/sync/trigger/${accountId}`)
}

export function cancelSync(accountId: string) {
  return api.post(`/sync/cancel/${accountId}`)
}

export function triggerFullSync(accountId: string) {
  return api.post(`/sync/trigger/${accountId}`, { type: "initial" })
}

export function triggerAllSyncs() {
  return api.post("/sync/trigger-all")
}

export function getSyncHistory(accountId: string) {
  return api.get(`/sync/history/${accountId}`).then((response) => response.data)
}

export function getSettings() {
  return api.get<AppSettings>("/settings").then((response) => response.data)
}

export function patchSettings(body: Record<string, unknown>) {
  return api.patch<AppSettings>("/settings", body).then((response) => response.data)
}

export function clearData(confirm: string) {
  return api.delete("/settings/data", {
    data: { confirm }
  })
}

export function clearLowConfidence(threshold = 0.3) {
  return api
    .delete<{ deleted: number }>("/settings/low-confidence", { data: { threshold } })
    .then((r) => r.data)
}
