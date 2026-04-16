import { ChevronRight, Plus, Trash2 } from "lucide-react"

import { StatusBadge } from "@/components/StatusBadge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import type { Application, ApplicationStatus } from "@/lib/types"
import { formatDate, formatRelativeTime } from "@/lib/utils"

const statuses: ApplicationStatus[] = [
  "APPLIED",
  "INTERVIEWING",
  "OFFER",
  "REJECTED",
  "WITHDRAWN"
]

type Props = {
  applications: Application[]
  onOpen: (id: string) => void
  onStatusChange: (id: string, status: ApplicationStatus) => void
  onDelete: (id: string) => void
  onAddInterview: (id: string) => void
}

export function ApplicationTable({
  applications,
  onOpen,
  onStatusChange,
  onDelete,
  onAddInterview
}: Props) {
  return (
    <div className="overflow-hidden rounded-[16px] bg-white shadow-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Applied</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.map((application) => (
              <TableRow key={application.id}>
                <TableCell>
                  <button
                    className="flex items-center gap-2 text-left"
                    onClick={() => onOpen(application.id)}
                  >
                    <div>
                      <p className="font-medium">{application.company}</p>
                      {application.emailSubject ? (
                        <p className="max-w-[260px] truncate text-xs text-[#898989]">
                          {application.emailSubject}
                        </p>
                      ) : null}
                    </div>
                    <ChevronRight className="h-4 w-4 text-[#a0a0a0]" />
                  </button>
                </TableCell>
                <TableCell>{application.role}</TableCell>
                <TableCell>
                  <StatusBadge status={application.status} />
                </TableCell>
                <TableCell>
                  {application.emailAccount?.label || application.emailAccount?.email || "Manual"}
                </TableCell>
                <TableCell>{application.appliedAt ? formatDate(application.appliedAt) : "—"}</TableCell>
                <TableCell>{formatRelativeTime(application.updatedAt)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <div className="w-[150px]">
                      <Select
                        value={application.status}
                        onValueChange={(value) =>
                          onStatusChange(application.id, value as ApplicationStatus)
                        }
                      >
                        <SelectTrigger className="h-9">
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
                    <Button size="sm" variant="ghost" onClick={() => onAddInterview(application.id)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onDelete(application.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
