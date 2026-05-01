import type { ReactNode } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import { useAuth } from "@/context/AuthContext"
import { Layout } from "@/components/Layout"
import Applications from "@/pages/Applications"
import CalendarPage from "@/pages/Calendar"
import Dashboard from "@/pages/Dashboard"
import GoogleOAuthCallback from "@/pages/GoogleOAuthCallback"
import Landing from "@/pages/Landing"
import Login from "@/pages/Login"
import Register from "@/pages/Register"
import SettingsPage from "@/pages/Settings"
import UserGoogleAuthCallback from "@/pages/UserGoogleAuthCallback"
import UsernameSetup from "@/pages/UsernameSetup"

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#242424] border-t-transparent" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  // Google-login user who hasn't set a username yet
  if (!user.username && window.location.pathname !== "/setup-username") {
    return <Navigate to="/setup-username" replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingOrDashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Google user-auth OAuth callback */}
        <Route path="/auth/user/google/callback" element={<UserGoogleAuthCallback />} />

        {/* Gmail-sync / Calendar OAuth callbacks (still require session) */}
        <Route
          path="/auth/google/callback"
          element={
            <ProtectedRoute>
              <GoogleOAuthCallback />
            </ProtectedRoute>
          }
        />
        <Route
          path="/auth/microsoft/callback"
          element={
            <ProtectedRoute>
              <GoogleOAuthCallback />
            </ProtectedRoute>
          }
        />

        {/* Username setup — requires a valid JWT but username may be null */}
        <Route path="/setup-username" element={<UsernameSetupGuard />} />

        {/* Protected app routes */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/applications" element={<Applications />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

// Show the landing page to visitors; redirect logged-in users straight to the app
function LandingOrDashboard() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#242424] border-t-transparent" />
      </div>
    )
  }

  return user ? <Navigate to="/dashboard" replace /> : <Landing />
}

// Separate guard for setup-username — needs a valid JWT but allows null username
function UsernameSetupGuard() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#242424] border-t-transparent" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (user.username) return <Navigate to="/dashboard" replace />

  return <UsernameSetup />
}
