import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import { Layout } from "@/components/Layout"
import Applications from "@/pages/Applications"
import CalendarPage from "@/pages/Calendar"
import Dashboard from "@/pages/Dashboard"
import GoogleOAuthCallback from "@/pages/GoogleOAuthCallback"
import SettingsPage from "@/pages/Settings"

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/auth/google/callback" element={<GoogleOAuthCallback />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/applications" element={<Applications />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
