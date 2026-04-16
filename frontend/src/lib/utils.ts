import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRelativeTime(value: string | Date | null | undefined) {
  if (!value) {
    return "never"
  }

  const date = value instanceof Date ? value : new Date(value)
  const diffMs = date.getTime() - Date.now()
  const absMinutes = Math.round(Math.abs(diffMs) / 60000)

  if (absMinutes < 1) {
    return "just now"
  }

  if (absMinutes < 60) {
    return diffMs < 0 ? `${absMinutes} min ago` : `in ${absMinutes} min`
  }

  const absHours = Math.round(absMinutes / 60)
  if (absHours < 24) {
    return diffMs < 0 ? `${absHours} hr ago` : `in ${absHours} hr`
  }

  const absDays = Math.round(absHours / 24)
  return diffMs < 0 ? `${absDays} day${absDays === 1 ? "" : "s"} ago` : `in ${absDays} days`
}

export function formatDateTime(value: string | Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(value instanceof Date ? value : new Date(value))
}

export function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(value instanceof Date ? value : new Date(value))
}
