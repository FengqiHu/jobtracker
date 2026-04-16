import { useState } from "react"
import axios from "axios"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CalendarPlus, Mail, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import {
  connectImap,
  deleteEmailAccount,
  getCalendarConnectUrl,
  getGmailConnectUrl,
  getOutlookConnectUrl,
  patchEmailAccount,
  triggerSync
} from "@/lib/api"
import type { EmailAccountSummary } from "@/lib/types"
import { formatRelativeTime } from "@/lib/utils"

function accountStatusColor(account: EmailAccountSummary) {
  const status = account.latestSync?.status
  if (status === "RUNNING") {
    return "bg-amber-400"
  }
  if (status === "FAILED") {
    return "bg-red-500"
  }
  return "bg-emerald-500"
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message
    if (typeof message === "string" && message) {
      return message
    }
  }

  return fallback
}

export function MailboxManager({ accounts }: { accounts: EmailAccountSummary[] }) {
  const queryClient = useQueryClient()
  const [imapOpen, setImapOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [form, setForm] = useState({
    label: "",
    host: "",
    port: "993",
    user: "",
    password: "",
    tls: true
  })
  const [formError, setFormError] = useState("")
  const isMicrosoftHost = /outlook|office365/i.test(form.host)
  const isGmailHost = /gmail|google/i.test(form.host)

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["email-accounts"] }),
      queryClient.invalidateQueries({ queryKey: ["sync-status"] }),
      queryClient.invalidateQueries({ queryKey: ["applications"] }),
      queryClient.invalidateQueries({ queryKey: ["application-stats"] })
    ])
  }

  const gmailMutation = useMutation({
    mutationFn: getGmailConnectUrl,
    onSuccess: ({ authUrl }) => {
      window.location.href = authUrl
    },
    onError: (error: unknown) =>
      toast.error(getApiErrorMessage(error, "Unable to start Gmail connection"))
  })

  const outlookMutation = useMutation({
    mutationFn: getOutlookConnectUrl,
    onSuccess: ({ authUrl }) => {
      window.location.href = authUrl
    },
    onError: (error: unknown) =>
      toast.error(getApiErrorMessage(error, "Unable to start Outlook connection"))
  })

  const imapMutation = useMutation({
    mutationFn: () =>
      connectImap({
        ...form,
        port: Number(form.port)
      }),
    onSuccess: async () => {
      await invalidateAll()
      toast.success("IMAP account connected")
      setImapOpen(false)
      setFormError("")
      setForm({
        label: "",
        host: "",
        port: "993",
        user: "",
        password: "",
        tls: true
      })
    },
    onError: (error: unknown) => {
      setFormError(getApiErrorMessage(error, "Unable to connect to the IMAP server"))
    }
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, syncEnabled }: { id: string; syncEnabled: boolean }) =>
      patchEmailAccount(id, { syncEnabled }),
    onSuccess: invalidateAll,
    onError: () => toast.error("Unable to update sync setting")
  })

  const syncMutation = useMutation({
    mutationFn: triggerSync,
    onSuccess: async () => {
      await invalidateAll()
      toast.success("Sync requested")
    },
    onError: () => toast.error("Unable to trigger sync")
  })

  const deleteMutation = useMutation({
    mutationFn: deleteEmailAccount,
    onSuccess: async () => {
      await invalidateAll()
      toast.success("Email account removed")
      setConfirmDelete(null)
    },
    onError: () => toast.error("Unable to delete email account")
  })

  const calendarMutation = useMutation({
    mutationFn: getCalendarConnectUrl,
    onSuccess: ({ authUrl }) => {
      window.location.href = authUrl
    },
    onError: () => toast.error("Unable to start Google Calendar connection")
  })

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => gmailMutation.mutate()}>Connect Gmail</Button>
        <Button variant="secondary" onClick={() => outlookMutation.mutate()}>
          Connect Outlook
        </Button>
        <Button variant="secondary" onClick={() => setImapOpen(true)}>
          Connect IMAP
        </Button>
      </div>

      <div className="mt-6 grid gap-4">
        {accounts.map((account) => (
          <Card key={account.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f4f4f4] shadow-card">
                  <Mail className="h-5 w-5 text-[#242424]" />
                </div>
                <div>
                  <CardTitle>{account.label}</CardTitle>
                  <CardDescription>{account.email}</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#898989]">
                <span className={`h-2.5 w-2.5 rounded-full ${accountStatusColor(account)}`} />
                {account.latestSync?.status ?? "Ready"}
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
              <div className="grid gap-3 text-sm text-[#898989] md:grid-cols-3">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em]">Provider</p>
                  <p className="text-[#242424]">{account.provider}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em]">Last sync</p>
                  <p className="text-[#242424]">{formatRelativeTime(account.lastSyncedAt)}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em]">Parsed emails</p>
                  <p className="text-[#242424]">{account.latestSync?.parsedEmails ?? 0}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-full bg-[#f7f7f7] px-3 py-2 shadow-card">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8a8a8a]">
                    Sync
                  </span>
                  <Switch
                    checked={account.syncEnabled}
                    onCheckedChange={(checked) =>
                      toggleMutation.mutate({ id: account.id, syncEnabled: checked })
                    }
                  />
                </div>
                {!account.calendarConnected ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => calendarMutation.mutate(account.id)}
                  >
                    <CalendarPlus className="h-4 w-4" />
                    Connect Calendar
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => syncMutation.mutate(account.id)}
                >
                  <RefreshCw className="h-4 w-4" />
                  Sync now
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(account.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {!accounts.length ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-[#898989]">
              No inboxes connected yet. Start with Gmail, Outlook, or IMAP and your real
              connections will appear here.
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Sheet open={imapOpen} onOpenChange={setImapOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Connect IMAP</SheetTitle>
            <SheetDescription>
              Add any IMAP inbox with validation before the credentials are saved.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={form.label}
                onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Host</Label>
                <Input
                  value={form.host}
                  onChange={(event) => setForm((current) => ({ ...current, host: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Port</Label>
                <Input
                  value={form.port}
                  onChange={(event) => setForm((current) => ({ ...current, port: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={form.user}
                onChange={(event) => setForm((current) => ({ ...current, user: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({ ...current, password: event.target.value }))
                }
              />
            </div>
            {isGmailHost ? (
              <div className="rounded-[14px] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
                <p className="font-medium">Gmail works better with Google OAuth.</p>
                <p className="mt-1 text-blue-900/80">
                  Use the button below instead of entering IMAP credentials unless you already
                  created a Google App Password.
                </p>
                <Button
                  className="mt-3"
                  type="button"
                  onClick={() => gmailMutation.mutate()}
                  disabled={gmailMutation.isPending}
                >
                  {gmailMutation.isPending ? "Opening Google OAuth..." : "Use Google OAuth Instead"}
                </Button>
              </div>
            ) : null}
            {isMicrosoftHost ? (
              <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Outlook and Microsoft 365 mailboxes often block normal password-based IMAP
                sign-in. If this mailbox rejects the login, use the Connect Outlook button
                instead of a password-based IMAP connection.
              </div>
            ) : null}
            <div className="flex items-center justify-between rounded-[14px] bg-[#f8f8f8] px-4 py-3 shadow-card">
              <div>
                <p className="text-sm font-medium text-[#242424]">Use TLS</p>
                <p className="text-xs text-[#898989]">Recommended for port 993 and modern providers.</p>
              </div>
              <Switch
                checked={form.tls}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, tls: checked }))}
              />
            </div>

            {formError ? <p className="text-sm text-red-500">{formError}</p> : null}

            <Button className="w-full" onClick={() => imapMutation.mutate()} disabled={imapMutation.isPending}>
              {imapMutation.isPending ? "Testing connection..." : "Save IMAP account"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(confirmDelete)} onOpenChange={(next) => !next && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete email account</DialogTitle>
            <DialogDescription>
              This removes the mailbox plus all linked applications, interviews, and sync jobs.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete)}
            >
              Delete account
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
