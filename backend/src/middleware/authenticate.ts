import type { Request, Response, NextFunction } from "express"
import { verifyToken } from "../lib/auth"

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" })
  }

  try {
    const payload = verifyToken(header.slice(7))
    req.user = { id: payload.userId, username: payload.username, name: payload.name }
    return next()
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" })
  }
}
