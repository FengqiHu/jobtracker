import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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
import { Textarea } from "@/components/ui/textarea"
import { createInterview, patchInterview } from "@/lib/api"
import type { Application, Interview } from "@/lib/types"

function toLocalInputValue(value?: string) {
  if (!value) {
    return ""
  }

  const date = new Date(value)
  const timezoneOffset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16)
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  applications: Application[]
  defaultApplicationId?: string
  interview?: Interview
}

export function InterviewDialog({
  open,
  onOpenChange,
  applications,
  defaultApplicationId,
  interview
}: Props) {
  const queryClient = useQueryClient()
  const [applicationId, setApplicationId] = useState(defaultApplicationId ?? "")
  const [title, setTitle] = useState("Interview")
  const [scheduledAt, setScheduledAt] = useState("")
  const [durationMinutes, setDurationMinutes] = useState("60")
  const [location, setLocation] = useState("")
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (!open) {
      return
    }

    setApplicationId(interview?.applicationId ?? defaultApplicationId ?? applications[0]?.id ?? "")
    setTitle(interview?.title ?? "Interview")
    setScheduledAt(toLocalInputValue(interview?.scheduledAt))
    setDurationMinutes(String(interview?.durationMinutes ?? 60))
    setLocation(interview?.location ?? "")
    setNotes(interview?.notes ?? "")
  }, [applications, defaultApplicationId, interview, open])

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        applicationId,
        title,
        scheduledAt: new Date(scheduledAt).toISOString(),
        durationMinutes: Number(durationMinutes),
        location: location || undefined,
        notes: notes || undefined
      }

      if (interview) {
        return patchInterview(interview.id, payload)
      }

      return createInterview(payload)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["interviews"] }),
        queryClient.invalidateQueries({ queryKey: ["applications"] }),
        queryClient.invalidateQueries({ queryKey: ["application"] }),
        queryClient.invalidateQueries({ queryKey: ["application-stats"] })
      ])
      toast.success(interview ? "Interview updated" : "Interview scheduled")
      onOpenChange(false)
    },
    onError: () => toast.error("Unable to save interview")
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{interview ? "Edit Interview" : "Schedule Interview"}</DialogTitle>
          <DialogDescription>
            Create a clean interview timeline and keep calendar sync in one place.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!interview ? (
            <div className="space-y-2">
              <Label>Application</Label>
              <Select value={applicationId} onValueChange={setApplicationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an application" />
                </SelectTrigger>
                <SelectContent>
                  {applications.map((application) => (
                    <SelectItem key={application.id} value={application.id}>
                      {application.company} — {application.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Date & time</Label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Duration</Label>
              <Select value={durationMinutes} onValueChange={setDurationMinutes}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["30", "45", "60", "90"].map((minutes) => (
                    <SelectItem key={minutes} value={minutes}>
                      {minutes} minutes
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Location</Label>
            <Input
              placeholder="Zoom, Google Meet, office address..."
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>

          <Button
            className="w-full"
            onClick={() => mutation.mutate()}
            disabled={
              mutation.isPending ||
              !applicationId ||
              !title.trim() ||
              !scheduledAt
            }
          >
            {mutation.isPending ? "Saving..." : interview ? "Save interview" : "Schedule interview"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
