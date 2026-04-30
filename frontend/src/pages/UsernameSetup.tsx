import { useState } from "react"
import { useNavigate } from "react-router-dom"

import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default function UsernameSetup() {
  const { user, setUsername, logout } = useAuth()
  const navigate = useNavigate()
  const [username, setUsernameInput] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (username.trim().length < 3) {
      setError("Username must be at least 3 characters")
      return
    }
    setLoading(true)
    try {
      await setUsername(username.trim())
      navigate("/dashboard", { replace: true })
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to set username"
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f5f5]">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-display text-[32px] font-semibold leading-none text-[#242424]">
            Job Tracker
          </p>
          <p className="mt-2 text-sm text-[#898989]">
            Welcome, {user?.name ?? "there"}! Choose your username.
          </p>
        </div>

        <Card className="shadow-card border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Pick a username</CardTitle>
            <CardDescription>
              Your username is unique and used to sign in. You can set it once.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="your_username"
                  required
                  autoFocus
                />
                <p className="text-xs text-[#898989]">At least 3 characters, must be unique</p>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Saving…" : "Continue"}
              </Button>
            </form>

            <button
              onClick={() => {
                logout()
                navigate("/login", { replace: true })
              }}
              className="mt-4 w-full text-center text-sm text-[#898989] hover:text-[#242424]"
            >
              Cancel and sign out
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
