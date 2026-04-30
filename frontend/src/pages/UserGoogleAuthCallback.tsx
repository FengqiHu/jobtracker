import { useEffect, useRef } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

import { useAuth } from "@/context/AuthContext"

export default function UserGoogleAuthCallback() {
  const [params] = useSearchParams()
  const { loginWithGoogleCode } = useAuth()
  const navigate = useNavigate()
  const called = useRef(false)

  useEffect(() => {
    if (called.current) return
    called.current = true

    const code = params.get("code")
    if (!code) {
      navigate("/login?error=missing_code", { replace: true })
      return
    }

    loginWithGoogleCode(code)
      .then(({ usernameRequired }) => {
        if (usernameRequired) {
          navigate("/setup-username", { replace: true })
        } else {
          navigate("/dashboard", { replace: true })
        }
      })
      .catch(() => {
        navigate("/login?error=google_failed", { replace: true })
      })
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-6 w-6 animate-spin rounded-full border-2 border-[#242424] border-t-transparent" />
        <p className="text-sm text-[#898989]">Completing Google sign-in…</p>
      </div>
    </div>
  )
}
