import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { MailboxManager } from "@/components/MailboxManager"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { clearData, clearLowConfidence, getEmailAccounts, getSettings, patchSettings } from "@/lib/api"

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [dangerOpen, setDangerOpen] = useState(false)
  const [confirm, setConfirm] = useState("")

  const accountsQuery = useQuery({
    queryKey: ["email-accounts"],
    queryFn: getEmailAccounts
  })
  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings
  })

  useEffect(() => {
    const connected = searchParams.get("connected")
    const calendar = searchParams.get("calendar")
    const message = searchParams.get("message")

    if (connected === "gmail") {
      toast.success("Gmail account connected")
    } else if (connected === "outlook") {
      toast.success("Outlook account connected")
    } else if (connected === "gmail-error") {
      toast.error(message || "Google account connection failed")
    } else if (connected === "outlook-error") {
      toast.error(message || "Outlook account connection failed")
    }
    if (calendar === "connected") {
      toast.success("Google Calendar connected")
    } else if (calendar === "error") {
      toast.error("Google Calendar connection failed")
    }
    if (connected || calendar) {
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const settingsMutation = useMutation({
    mutationFn: patchSettings,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings"] })
      toast.success("Preferences updated")
    },
    onError: () => toast.error("Unable to update settings")
  })

  const clearMutation = useMutation({
    mutationFn: () => clearData(confirm),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["applications"] }),
        queryClient.invalidateQueries({ queryKey: ["application-stats"] }),
        queryClient.invalidateQueries({ queryKey: ["interviews"] })
      ])
      toast.success("Application data cleared")
      setDangerOpen(false)
      setConfirm("")
    },
    onError: () => toast.error("Unable to clear data")
  })

  const lowConfidenceMutation = useMutation({
    mutationFn: () => clearLowConfidence(0.5),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["applications"] }),
        queryClient.invalidateQueries({ queryKey: ["application-stats"] }),
        queryClient.invalidateQueries({ queryKey: ["interviews"] })
      ])
      toast.success(`Removed ${result.deleted} low-confidence application(s)`)
    },
    onError: () => toast.error("Unable to remove low-confidence applications")
  })

  const settings = settingsQuery.data

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] bg-white px-6 py-8 shadow-card md:px-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#8a8a8a]">
          Settings
        </p>
        <h1 className="text-[36px] leading-[1.05] md:text-[56px]">Connections, sync cadence, and safe cleanup.</h1>
      </section>

      <Tabs defaultValue="accounts" className="space-y-6">
        <TabsList>
          <TabsTrigger value="accounts">Email Accounts</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-4">
          <MailboxManager accounts={accountsQuery.data ?? []} />
        </TabsContent>

        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 md:flex-row md:items-end">
              <div className="space-y-2 md:flex-1">
                <Label>Sync interval</Label>
                <Select
                  value={String(settings?.syncIntervalMinutes ?? 15)}
                  onValueChange={(value) =>
                    settingsMutation.mutate({ syncIntervalMinutes: Number(value) })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["5", "15", "30", "60"].map((value) => (
                      <SelectItem key={value} value={value}>
                        Every {value} minutes
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:flex-1">
                <Label>Initial sync window</Label>
                <Select
                  value={String(settings?.initialSyncDays ?? 90)}
                  onValueChange={(value) =>
                    settingsMutation.mutate({ initialSyncDays: Number(value) })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["30", "60", "90", "180"].map((value) => (
                      <SelectItem key={value} value={value}>
                        {value} days
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-red-100">
            <CardHeader>
              <CardTitle>Danger zone</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="max-w-xl text-sm leading-6 text-[#898989]">
                  Remove applications where AI confidence is below 30% — likely false
                  positives from non-job emails.
                </p>
                <Button
                  variant="secondary"
                  onClick={() => lowConfidenceMutation.mutate()}
                  disabled={lowConfidenceMutation.isPending}
                >
                  {lowConfidenceMutation.isPending ? "Removing..." : "Remove low-confidence"}
                </Button>
              </div>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="max-w-xl text-sm leading-6 text-[#898989]">
                  Clear all application and interview data while keeping your email connections
                  and sync history intact.
                </p>
                <Button variant="secondary" onClick={() => setDangerOpen(true)}>
                  Clear all application data
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dangerOpen} onOpenChange={setDangerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear all application data</DialogTitle>
            <DialogDescription>
              Type DELETE to confirm. Email accounts and sync history will be preserved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Confirmation</Label>
              <Input value={confirm} onChange={(event) => setConfirm(event.target.value)} />
            </div>
            <Button
              className="w-full"
              onClick={() => clearMutation.mutate()}
              disabled={confirm !== "DELETE" || clearMutation.isPending}
            >
              {clearMutation.isPending ? "Clearing..." : "Delete application data"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
