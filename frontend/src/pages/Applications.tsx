import { useDeferredValue, useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Filter, Plus } from "lucide-react"
import { toast } from "sonner"

import { ApplicationDetailSheet } from "@/components/ApplicationDetailSheet"
import { ApplicationTable } from "@/components/ApplicationTable"
import { InterviewDialog } from "@/components/InterviewDialog"
import { KanbanBoard } from "@/components/KanbanBoard"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createApplication, deleteApplication, getEmailAccounts, patchApplication } from "@/lib/api"
import { useApplications } from "@/hooks/useApplications"
import type { ApplicationStatus } from "@/lib/types"

const statuses: ApplicationStatus[] = [
  "APPLIED",
  "INTERVIEWING",
  "OFFER",
  "REJECTED",
  "WITHDRAWN"
]

export default function Applications() {
  const queryClient = useQueryClient()
  const [view, setView] = useState<"table" | "kanban">(() => {
    const stored = window.localStorage.getItem("applications-view")
    return stored === "kanban" ? "kanban" : "table"
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [scheduleForId, setScheduleForId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const deferredSearch = useDeferredValue(search)
  const [accountId, setAccountId] = useState("all")
  const [selectedStatuses, setSelectedStatuses] = useState<ApplicationStatus[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({
    company: "",
    role: "",
    status: "APPLIED",
    notes: "",
    appliedAt: ""
  })

  useEffect(() => {
    window.localStorage.setItem("applications-view", view)
  }, [view])

  const applicationsQuery = useApplications({
    limit: 100,
    search: deferredSearch || undefined,
    accountId: accountId === "all" ? undefined : accountId,
    status: selectedStatuses.length ? selectedStatuses : undefined,
    sortBy: "updatedAt",
    order: "desc"
  })
  const accountsQuery = useQuery({
    queryKey: ["email-accounts"],
    queryFn: getEmailAccounts
  })

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["applications"] }),
      queryClient.invalidateQueries({ queryKey: ["application-stats"] }),
      queryClient.invalidateQueries({ queryKey: ["interviews"] })
    ])
  }

  const patchMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ApplicationStatus }) =>
      patchApplication(id, { status }),
    onSuccess: invalidateAll,
    onError: () => toast.error("Unable to update application")
  })

  const deleteMutation = useMutation({
    mutationFn: deleteApplication,
    onSuccess: async () => {
      await invalidateAll()
      toast.success("Application deleted")
    },
    onError: () => toast.error("Unable to delete application")
  })

  const createMutation = useMutation({
    mutationFn: () => createApplication(addForm),
    onSuccess: async () => {
      await invalidateAll()
      toast.success("Application added")
      setAddOpen(false)
      setAddForm({
        company: "",
        role: "",
        status: "APPLIED",
        notes: "",
        appliedAt: ""
      })
    },
    onError: () => toast.error("Unable to create application")
  })

  const data = applicationsQuery.data?.data ?? []
  const scheduleApplications =
    applicationsQuery.data?.data.filter((application) => application.id === scheduleForId) ?? []

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] bg-white px-6 py-8 shadow-card md:px-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#8a8a8a]">
          Applications
        </p>
        <h1 className="text-[36px] leading-[1.05] md:text-[56px]">Hold the full hiring funnel in one view.</h1>
      </section>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Filter the pipeline</CardTitle>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant={view === "table" ? "default" : "secondary"} onClick={() => setView("table")}>
              Table
            </Button>
            <Button variant={view === "kanban" ? "default" : "secondary"} onClick={() => setView("kanban")}>
              Kanban
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 xl:grid-cols-[1.3fr_220px_200px_auto]">
            <Input
              placeholder="Search company or role"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {accountsQuery.data?.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">
                  <Filter className="h-4 w-4" />
                  Status filters
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {statuses.map((status) => {
                  const checked = selectedStatuses.includes(status)
                  return (
                    <DropdownMenuItem
                      key={status}
                      onSelect={(event) => {
                        event.preventDefault()
                        setSelectedStatuses((current) =>
                          checked ? current.filter((item) => item !== status) : [...current, status]
                        )
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox checked={checked} />
                        {status}
                      </div>
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Add application
            </Button>
          </div>

          {view === "table" ? (
            <ApplicationTable
              applications={data}
              onOpen={setSelectedId}
              onStatusChange={(id, status) => patchMutation.mutate({ id, status })}
              onDelete={(id) => deleteMutation.mutate(id)}
              onAddInterview={setScheduleForId}
            />
          ) : (
            <KanbanBoard
              applications={data}
              onOpen={setSelectedId}
              onStatusChange={(id, status) => patchMutation.mutate({ id, status })}
              onAddInterview={setScheduleForId}
            />
          )}

          {!applicationsQuery.isLoading && !data.length ? (
            <div className="rounded-[16px] border border-dashed border-[#dedede] px-4 py-12 text-center text-sm text-[#898989]">
              No applications match the current filters.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <ApplicationDetailSheet
        applicationId={selectedId}
        open={Boolean(selectedId)}
        onOpenChange={(open) => !open && setSelectedId(null)}
      />

      <InterviewDialog
        open={Boolean(scheduleForId)}
        onOpenChange={(open) => !open && setScheduleForId(null)}
        applications={scheduleApplications}
        defaultApplicationId={scheduleForId ?? undefined}
      />

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Application</DialogTitle>
            <DialogDescription>
              Manually track roles that didn’t come in through email sync.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Company</Label>
              <Input
                value={addForm.company}
                onChange={(event) => setAddForm((current) => ({ ...current, company: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input
                value={addForm.role}
                onChange={(event) => setAddForm((current) => ({ ...current, role: event.target.value }))}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={addForm.status}
                  onValueChange={(value) => setAddForm((current) => ({ ...current, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Applied date</Label>
                <Input
                  type="date"
                  value={addForm.appliedAt}
                  onChange={(event) =>
                    setAddForm((current) => ({ ...current, appliedAt: event.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={addForm.notes}
                onChange={(event) => setAddForm((current) => ({ ...current, notes: event.target.value }))}
              />
            </div>

            <Button
              className="w-full"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !addForm.company || !addForm.role}
            >
              {createMutation.isPending ? "Saving..." : "Create application"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
