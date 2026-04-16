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
    <div className="flex min-h-screen">
      <aside className="fixed left-0 top-0 flex h-screen w-[280px] flex-col bg-[#fbfbfb] p-5 shadow-[1px_0_0_0_#ebebeb]">
        <div className="mb-8">
          <p className="font-display text-[32px] font-semibold leading-none text-[#242424]">
            Job Tracker
          </p>
          <p className="mt-3 text-sm leading-6 text-[#898989]">
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

        <div className="mt-auto">
          <SyncStatusBar />
        </div>
      </aside>

      <main className="ml-[280px] min-h-screen flex-1 space-y-6 p-6">
        {children}
      </main>
    </div>
  )
}
