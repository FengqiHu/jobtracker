import { Link } from "react-router-dom"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/StatusBadge"
import { useApplications, useApplicationStats } from "@/hooks/useApplications"
import { useUpcomingInterviews } from "@/hooks/useInterviews"
import { formatDateTime, formatRelativeTime } from "@/lib/utils"

function StatCard({
  label,
  value,
  loading
}: {
  label: string
  value: string | number
  loading?: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8a8a8a]">{label}</p>
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-10 w-20" /> : <p className="font-display text-[42px] leading-none">{value}</p>}
      </CardContent>
    </Card>
  )
}

export default function Dashboard() {
  const statsQuery = useApplicationStats()
  const interviewsQuery = useUpcomingInterviews()
  const recentQuery = useApplications({
    limit: 8,
    sortBy: "updatedAt",
    order: "desc"
  })

  const stats = statsQuery.data
  const upcoming = interviewsQuery.data ?? []
  const recent = recentQuery.data?.data ?? []

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] bg-white px-6 py-8 shadow-card md:px-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#8a8a8a]">
          Overview
        </p>
        <h1 className="max-w-3xl text-[36px] leading-[1.05] md:text-[56px]">
          Follow every application from first email to final offer.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[#898989]">
          Designed like a calm command center: monochrome, spacious, and tuned for steady
          progress without noisy dashboards.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total applications" value={stats?.total ?? 0} loading={statsQuery.isLoading} />
        <StatCard
          label="Active"
          value={(stats?.APPLIED ?? 0) + (stats?.INTERVIEWING ?? 0)}
          loading={statsQuery.isLoading}
        />
        <StatCard
          label="Upcoming interviews"
          value={upcoming.length}
          loading={interviewsQuery.isLoading}
        />
        <StatCard label="Offers received" value={stats?.OFFER ?? 0} loading={statsQuery.isLoading} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Upcoming interviews</CardTitle>
              <p className="text-sm text-[#898989]">The next conversations already on the calendar.</p>
            </div>
            <Link to="/calendar" className="text-sm text-[#242424] underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {interviewsQuery.isLoading ? (
              <>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </>
            ) : upcoming.length ? (
              upcoming.slice(0, 5).map((interview) => (
                <div key={interview.id} className="rounded-[14px] bg-[#fafafa] px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-[#242424]">{interview.application.company}</p>
                      <p className="text-sm text-[#898989]">{interview.application.role}</p>
                    </div>
                    <StatusBadge status={interview.application.status} />
                  </div>
                  <p className="mt-3 text-sm text-[#242424]">{formatDateTime(interview.scheduledAt)}</p>
                  <p className="text-sm text-[#898989]">{interview.durationMinutes} minutes</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-[#898989]">
                No upcoming interviews. Schedule one from an application.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Recent activity</CardTitle>
              <p className="text-sm text-[#898989]">The latest status changes across your pipeline.</p>
            </div>
            <Link to="/applications" className="text-sm text-[#242424] underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentQuery.isLoading ? (
              <>
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </>
            ) : (
              recent.map((application) => (
                <div
                  key={application.id}
                  className="flex items-center justify-between rounded-[14px] bg-[#fafafa] px-4 py-4"
                >
                  <div>
                    <p className="font-medium text-[#242424]">{application.company}</p>
                    <p className="text-sm text-[#898989]">{application.role}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={application.status} />
                    <p className="mt-2 text-xs text-[#898989]">{formatRelativeTime(application.updatedAt)}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
