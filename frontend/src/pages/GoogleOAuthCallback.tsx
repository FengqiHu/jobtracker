import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

import { exchangeCalendarCode, exchangeGmailCode } from "@/lib/api"

export default function GoogleOAuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [message, setMessage] = useState("Completing Google connection...")

  useEffect(() => {
    let cancelled = false

    async function completeOAuth() {
      const error = searchParams.get("error")
      const code = searchParams.get("code")
      const state = searchParams.get("state") ?? ""

      if (error) {
        navigate("/settings?connected=error", { replace: true })
        return
      }

      if (!code) {
        navigate("/settings?connected=error", { replace: true })
        return
      }

      try {
        if (state.startsWith("calendar:")) {
          if (!cancelled) {
            setMessage("Connecting Google Calendar...")
          }
          await exchangeCalendarCode({ code, state })
          navigate("/settings?calendar=connected", { replace: true })
          return
        }

        await exchangeGmailCode(code)
        navigate("/settings?connected=gmail", { replace: true })
      } catch {
        navigate(
          state.startsWith("calendar:")
            ? "/settings?calendar=error"
            : "/settings?connected=error",
          { replace: true }
        )
      }
    }

    void completeOAuth()

    return () => {
      cancelled = true
    }
  }, [navigate, searchParams])

  return (
    <div className="rounded-[24px] bg-white px-6 py-16 text-center shadow-card md:px-8">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#8a8a8a]">
        Google OAuth
      </p>
      <h1 className="font-display text-[36px] font-semibold leading-[1.05] text-[#242424] md:text-[52px]">
        {message}
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[#898989]">
        You will be redirected back to Settings as soon as the authorization code is exchanged.
      </p>
    </div>
  )
}
