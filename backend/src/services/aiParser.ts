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

export async function isJobApplicationEmail(
  subject: string,
  from: string
): Promise<boolean> {
  const client = getClient()
  const response = await client.responses.create({
    model: "gpt-5.4-nano",
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
