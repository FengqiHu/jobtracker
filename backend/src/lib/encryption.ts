import crypto from "crypto"

import "./env"

const rawKey = process.env.TOKEN_ENCRYPTION_KEY

if (!rawKey || !/^[a-fA-F0-9]{64}$/.test(rawKey)) {
  throw new Error(
    "TOKEN_ENCRYPTION_KEY must be set and contain exactly 64 hex characters."
  )
}

const key = Buffer.from(rawKey, "hex")

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final()
  ])
  const authTag = cipher.getAuthTag()

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`
}

export function decrypt(encrypted: string): string {
  const [ivHex, authTagHex, ciphertextHex] = encrypted.split(":")

  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Encrypted payload must be formatted as iv:authTag:ciphertext")
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivHex, "hex")
  )
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"))

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final()
  ])

  return decrypted.toString("utf8")
}
