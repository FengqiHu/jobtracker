import type { PropsWithChildren } from "react"
import { NavLink } from "react-router-dom"
import { BriefcaseBusiness, CalendarDays, LayoutDashboard, Settings } from "lucide-react"

import { SyncStatusBar } from "@/components/SyncStatusBar"
import { cn } from "@/lib/utils"

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/applications", label: "Applications", icon: BriefcaseBusiness },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/settings", label: "Settings", icon: Settings }
]

export function Layout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto grid min-h-screen max-w-[1400px] gap-6 px-4 py-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-6 lg:py-6">
        <aside className="rounded-[24px] bg-[#fbfbfb] p-5 shadow-card">
          <div className="mb-8">
            <p className="font-display text-[32px] font-semibold leading-none text-[#242424]">
              Job Tracker
            </p>
            <p className="mt-3 max-w-[18rem] text-sm leading-6 text-[#898989]">
              A monochrome command center for applications, interviews, inbox sync, and
              momentum.
            </p>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-[14px] px-4 py-3 text-sm font-medium transition-all",
                      isActive
                        ? "bg-white text-[#242424] shadow-card"
                        : "text-[#7b7b7b] hover:bg-white hover:text-[#242424]"
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              )
            })}
          </nav>

          <div className="mt-8 hidden lg:block">
            <SyncStatusBar />
          </div>
        </aside>

        <main className="space-y-6">
          <div className="lg:hidden">
            <SyncStatusBar />
          </div>
          {children}
        </main>
      </div>
    </div>
  )
}
