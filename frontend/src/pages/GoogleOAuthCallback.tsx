import { useEffect, useMemo, useState } from "react"
import axios from "axios"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"

import {
  exchangeCalendarCode,
  exchangeGmailCode,
  exchangeOutlookCode
} from "@/lib/api"

function getApiErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message
    if (typeof message === "string" && message) {
      return message
    }
  }

  return ""
}

export default function GoogleOAuthCallback() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isMicrosoftRoute = location.pathname.includes("/microsoft/")
  const providerLabel = useMemo(
    () => (isMicrosoftRoute ? "Outlook" : "Google"),
    [isMicrosoftRoute]
  )
  const [message, setMessage] = useState(`Completing ${providerLabel} connection...`)

  useEffect(() => {
    let cancelled = false

    async function completeOAuth() {
      const error = searchParams.get("error")
      const code = searchParams.get("code")
      const state = searchParams.get("state") ?? ""

      if (error) {
        navigate(
          isMicrosoftRoute
            ? "/settings?connected=outlook-error"
            : "/settings?connected=gmail-error",
          { replace: true }
        )
        return
      }

      if (!code) {
        navigate(
          isMicrosoftRoute
            ? "/settings?connected=outlook-error"
            : "/settings?connected=gmail-error",
          { replace: true }
        )
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

        if (isMicrosoftRoute || state === "outlook") {
          if (!cancelled) {
            setMessage("Connecting Outlook mailbox...")
          }
          await exchangeOutlookCode(code)
          navigate("/settings?connected=outlook", { replace: true })
          return
        }

        await exchangeGmailCode(code)
        navigate("/settings?connected=gmail", { replace: true })
      } catch (error) {
        const reason = getApiErrorMessage(error)
        const search = new URLSearchParams({
          connected: state.startsWith("calendar:")
            ? "gmail-error"
            : isMicrosoftRoute || state === "outlook"
              ? "outlook-error"
              : "gmail-error"
        })
        if (reason) {
          search.set("message", reason)
        }
        navigate(
          state.startsWith("calendar:")
            ? "/settings?calendar=error"
            : `/settings?${search.toString()}`,
          { replace: true }
        )
      }
    }

    void completeOAuth()

    return () => {
      cancelled = true
    }
  }, [isMicrosoftRoute, navigate, searchParams])

  return (
    <div className="rounded-[24px] bg-white px-6 py-16 text-center shadow-card md:px-8">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#8a8a8a]">
        {providerLabel} OAuth
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
