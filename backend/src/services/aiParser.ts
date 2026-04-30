import OpenAI from "openai"
import { zodTextFormat } from "openai/helpers/zod"
import { z } from "zod"

import { logger } from "../lib/logger"

export type ParsedEmail = {
  company: string
  role: string
  status: "APPLIED" | "INTERVIEWING" | "OFFER" | "REJECTED"
  interviewDate: string | null
  confidence: number
}

const parsedEmailSchema = z.object({
  company: z.string(),
  role: z.string(),
  status: z.enum(["APPLIED", "INTERVIEWING", "OFFER", "REJECTED"]),
  interviewDate: z.string().nullable(),
  confidence: z.number().min(0).max(1)
})

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY must be configured before parsing job emails.")
  }

  return new OpenAI({ apiKey })
}

export type ApplicationCandidate = {
  id: string
  role: string
  recentSubjects: string[]
}

/**
 * Asks the AI whether an incoming email belongs to one of the candidate application
 * flows, or is a new independent application.
 *
 * Returns the matching application ID, or null if the email starts a new flow.
 * Called only when heuristic matching fails and at least one candidate has prior emails.
 */
export async function matchEmailToApplication(
  newEmail: { subject: string; from: string; bodySnippet: string },
  candidates: ApplicationCandidate[]
): Promise<string | null> {
  if (candidates.length === 0) return null

  const client = getClient()

  const candidateList = candidates
    .map(
      (c) =>
        `ID: ${c.id}\nRole: ${c.role}\nPrevious emails in this flow:\n${c.recentSubjects.map((s) => `  - ${s}`).join("\n")}`
    )
    .join("\n\n")

  try {
    const response = await client.responses.create({
      model: "gpt-5.4-mini",
      max_output_tokens: 50,
      input: [
        {
          role: "system",
          content:
            "You decide whether an incoming job email belongs to an existing application flow or starts a new one. " +
            "Reply with ONLY the application ID (exactly as shown) if it matches an existing flow, or NEW if none match. No explanation."
        },
        {
          role: "user",
          content:
            `New email:\nFrom: ${newEmail.from}\nSubject: ${newEmail.subject}` +
            (newEmail.bodySnippet ? `\nBody: ${newEmail.bodySnippet.slice(0, 400)}` : "") +
            `\n\nExisting application flows at this company:\n${candidateList}` +
            `\n\nDoes the new email belong to one of these flows? Consider: same hiring process, same role (even if the name differs across emails), scheduling, assessments, updates, or follow-ups for the same position.\n\nAnswer:`
        }
      ]
    })

    const answer = response.output_text.trim()
    const matched = candidates.find((c) => c.id === answer)
    return matched ? matched.id : null
  } catch (error) {
    logger.warn({ error }, "AI application matcher failed")
    return null
  }
}

export async function isJobApplicationEmail(
  subject: string,
  from: string
): Promise<boolean> {
  const client = getClient()
  const response = await client.responses.create({
    model: "gpt-5.4-mini",
    max_output_tokens: 16,
    input: [
      {
        role: "system",
        content:
          "You are a classifier. Reply with only the word YES or NO, nothing else."
      },
      {
        role: "user",
        content: `Is this email related to a job application? Consider: application confirmations,
interview invitations, rejection notices, offer letters, recruiter outreach,
background check requests, or any status update about a job application. Exclude generic newsletters, networking emails, job news, account created notifications, or unrelated subjects.

From: ${from}
Subject: ${subject}`
      }
    ]
  })

  return response.output_text.trim().toUpperCase() === "YES"
}

export async function parseJobEmail(
  subject: string,
  body: string,
  from: string
): Promise<ParsedEmail | null> {
  const client = getClient()

  try {
    const response = await client.responses.parse({
      model: "gpt-5.4-mini",
      max_output_tokens: 300,
      input: [
        {
          role: "system",
          content:
            "Extract structured job application information from the email. " +
            "Use these status rules: APPLIED for application received or confirmed; " +
            "INTERVIEWING for interview scheduled, invited, or requested; " +
            "OFFER for job offer extended; REJECTED for application declined, position filled, or moved forward with other candidates. " +
            "For appointment/calendar booking confirmation emails (e.g. 'Appointment booked:', 'Interview scheduled'), the company is the organization offering the job — not the interviewer's name, not the scheduling tool, and not the recipient's email address. Extract the company from the email body if it is not clear from the subject. " +
            "Lower confidence when the email is ambiguous, or this is not a job application email (including job news, account created notifications, generic newsletters)."
        },
        {
          role: "user",
          content: `Extract the job application details from this email.

From: ${from}
Subject: ${subject}
Body:
${body}`
        }
      ],
      text: {
        format: zodTextFormat(parsedEmailSchema, "parsed_job_email")
      }
    })

    if (!response.output_parsed) {
      logger.warn({ raw: response.output_text }, "OpenAI parser returned no structured output")
      return null
    }

    return response.output_parsed
  } catch (error) {
    logger.warn({ error }, "Failed to parse OpenAI email parser response")
    return null
  }
}
