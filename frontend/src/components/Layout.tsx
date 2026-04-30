import type { PropsWithChildren } from "react"
import { NavLink, useNavigate } from "react-router-dom"
import { BriefcaseBusiness, CalendarDays, LayoutDashboard, LogOut, Settings } from "lucide-react"

import { useAuth } from "@/context/AuthContext"
import { SyncStatusBar } from "@/components/SyncStatusBar"
import { cn } from "@/lib/utils"

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/applications", label: "Applications", icon: BriefcaseBusiness },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/settings", label: "Settings", icon: Settings }
]

export function Layout({ children }: PropsWithChildren) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate("/login", { replace: true })
  }

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

        <div className="mt-auto space-y-3">
          <SyncStatusBar />

          {user && (
            <div className="flex items-center justify-between rounded-[14px] bg-white px-4 py-3 shadow-card">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[#242424]">{user.name}</p>
                <p className="truncate text-xs text-[#898989]">
                  @{user.username ?? user.email ?? ""}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="ml-2 shrink-0 text-[#898989] transition-colors hover:text-[#242424]"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="ml-[280px] min-h-screen flex-1 space-y-6 p-6">
        {children}
      </main>
    </div>
  )
}
