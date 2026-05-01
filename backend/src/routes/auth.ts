import bcrypt from "bcryptjs"
import { Router } from "express"

import { signToken } from "../lib/auth"
import { prisma } from "../lib/prisma"
import { authenticate } from "../middleware/authenticate"
import {
  exchangeGoogleUserCode,
  getGoogleUserAuthUrl
} from "../services/googleUserAuth"

export const authRoutes = Router()

function userPayload(user: { id: string; username: string | null; name: string }) {
  return { userId: user.id, username: user.username, name: user.name }
}

function publicUser(user: {
  id: string
  username: string | null
  name: string
  email: string | null
  googleId: string | null
}) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    hasPassword: false, // filled by caller
    googleLinked: !!user.googleId
  }
}

// ── Register (username + password) ─────────────────────────────────────────
authRoutes.post("/auth/register", async (req, res) => {
  const { username, name, password } = req.body as Record<string, string>

  if (!username?.trim() || !name?.trim() || !password) {
    return res.status(400).json({ message: "Username, name, and password are required" })
  }
  if (username.trim().length < 3) {
    return res.status(400).json({ message: "Username must be at least 3 characters" })
  }
  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" })
  }

  const taken = await prisma.user.findUnique({ where: { username: username.trim() } })
  if (taken) {
    return res.status(409).json({ message: "Username is already taken" })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: { username: username.trim(), name: name.trim(), passwordHash }
  })

  const token = signToken(userPayload(user))
  return res.status(201).json({
    token,
    user: { ...publicUser(user), hasPassword: true }
  })
})

// ── Login (username + password) ─────────────────────────────────────────────
authRoutes.post("/auth/login", async (req, res) => {
  const { username, password } = req.body as Record<string, string>
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" })
  }

  const user = await prisma.user.findUnique({ where: { username: username.trim() } })
  if (!user || !user.passwordHash) {
    return res.status(401).json({ message: "Invalid credentials" })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return res.status(401).json({ message: "Invalid credentials" })
  }

  const token = signToken(userPayload(user))
  return res.json({
    token,
    user: { ...publicUser(user), hasPassword: true }
  })
})

// ── Google OAuth — get auth URL ──────────────────────────────────────────────
authRoutes.get("/auth/google/url", (_req, res) => {
  try {
    res.json({ authUrl: getGoogleUserAuthUrl() })
  } catch (err) {
    res.status(500).json({
      message: err instanceof Error ? err.message : "Google login is not configured"
    })
  }
})

// ── Google OAuth — exchange code ─────────────────────────────────────────────
authRoutes.post("/auth/google/exchange", async (req, res) => {
  const code = String(req.body.code ?? "")
  if (!code) {
    return res.status(400).json({ message: "Missing Google OAuth code" })
  }

  let googleUser: { googleId: string; email: string; name: string }
  try {
    googleUser = await exchangeGoogleUserCode(code)
  } catch (err) {
    return res.status(400).json({
      message: err instanceof Error ? err.message : "Failed to exchange Google code"
    })
  }

  // Find existing user by googleId, or by email, or create new
  let user = await prisma.user.findUnique({ where: { googleId: googleUser.googleId } })

  if (!user && googleUser.email) {
    // Link to existing account if email matches
    user = await prisma.user.findUnique({ where: { email: googleUser.email } }) ?? null
    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: googleUser.googleId }
      })
    }
  }

  if (!user) {
    // Create new user — username not set yet
    user = await prisma.user.create({
      data: {
        name: googleUser.name,
        email: googleUser.email || undefined,
        googleId: googleUser.googleId
      }
    })
  }

  const token = signToken(userPayload(user))
  return res.json({
    token,
    user: { ...publicUser(user), hasPassword: !!user.passwordHash },
    // Signal to frontend that this Google user still needs to pick a username
    usernameRequired: !user.username
  })
})

// ── Set username (after Google OAuth) ───────────────────────────────────────
authRoutes.patch("/auth/username", authenticate, async (req, res) => {
  const { username } = req.body as Record<string, string>
  if (!username?.trim() || username.trim().length < 3) {
    return res.status(400).json({ message: "Username must be at least 3 characters" })
  }

  const taken = await prisma.user.findUnique({ where: { username: username.trim() } })
  if (taken && taken.id !== req.user!.id) {
    return res.status(409).json({ message: "Username is already taken" })
  }

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { username: username.trim() }
  })

  // Issue a fresh token with the new username
  const token = signToken(userPayload(user))
  return res.json({
    token,
    user: { ...publicUser(user), hasPassword: !!user.passwordHash }
  })
})

// ── Current user ─────────────────────────────────────────────────────────────
authRoutes.get("/auth/me", authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } })
  if (!user) return res.status(404).json({ message: "User not found" })
  return res.json({ ...publicUser(user), hasPassword: !!user.passwordHash })
})

// ── Update profile (name + username) ─────────────────────────────────────────
authRoutes.patch("/auth/profile", authenticate, async (req, res) => {
  const { name, username } = req.body as Record<string, string>

  if (name !== undefined && !name.trim()) {
    return res.status(400).json({ message: "Display name cannot be empty" })
  }
  if (username !== undefined) {
    if (username.trim().length < 3) {
      return res.status(400).json({ message: "Username must be at least 3 characters" })
    }
    const taken = await prisma.user.findUnique({ where: { username: username.trim() } })
    if (taken && taken.id !== req.user!.id) {
      return res.status(409).json({ message: "Username is already taken" })
    }
  }

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(username !== undefined ? { username: username.trim() } : {})
    }
  })

  const token = signToken(userPayload(user))
  return res.json({ token, user: { ...publicUser(user), hasPassword: !!user.passwordHash } })
})

// ── Change / set password ─────────────────────────────────────────────────────
authRoutes.patch("/auth/password", authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body as Record<string, string>

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: "New password must be at least 6 characters" })
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } })
  if (!user) return res.status(404).json({ message: "User not found" })

  if (user.passwordHash) {
    if (!currentPassword) {
      return res.status(400).json({ message: "Current password is required" })
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) {
      return res.status(401).json({ message: "Current password is incorrect" })
    }
  }

  const passwordHash = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } })

  return res.json({ message: "Password updated" })
})
