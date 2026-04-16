/**
 * Subject keywords — the PRIMARY filter.
 * Covers all stages of a job search: application, interview, offer, rejection,
 * recruiter outreach, assessments, and background checks.
 * Intentionally comprehensive: false positives here are cheap (caught by AI confidence).
 * Missing a real job email is far more costly than sending one extra to the AI.
 */
const SUBJECT_KEYWORDS = [
  // Application received / confirmed
  "thank you for applying",
  "thank you for your application",
  "we received your application",
  "your application to",
  "your application for",
  "application received",
  "application submitted",
  "application confirmed",
  "you applied",
  "we've received your",
  // Generic "application" — broad but useful; the AI rejects non-job uses
  "application",
  // Interview
  "interview",
  "phone screen",
  "phone call",
  "video call",
  "hiring manager",
  "technical assessment",
  "technical interview",
  "coding challenge",
  "coding assessment",
  "take-home",
  "skills assessment",
  "online assessment",
  // Offer
  "offer letter",
  "job offer",
  "offer of employment",
  "we'd like to offer",
  "compensation package",
  // Rejection
  "regret to inform",
  "not moving forward",
  "other candidates",
  "filled the position",
  "not selected",
  "we will not be moving",
  "unfortunately",
  "not be proceeding",
  // Recruiter outreach
  "recruiter",
  "recruiting",
  "recruitment",
  "talent acquisition",
  "i came across your profile",
  "exciting opportunity",
  "we're hiring",
  "open role",
  "job opening",
  "open position",
  // Post-offer / onboarding
  "background check",
  "reference check",
  "onboarding",
  "start date",
  "your candidacy",
  "next steps",
]

/**
 * ATS / job-board sender domains — SECONDARY filter.
 * Emails from these platforms are almost always job-related even when the
 * subject line is generic (e.g. "Update from Greenhouse").
 */
const ATS_SENDER_DOMAINS = [
  "greenhouse.io", "lever.co", "workday.com", "myworkdayjobs.com",
  "smartrecruiters.com", "bamboohr.com", "icims.com", "taleo.net",
  "jobvite.com", "successfactors.com", "ashbyhq.com", "breezy.hr",
  "recruitee.com", "workable.com", "teamtailor.com", "personio.com",
  "comeet.com", "pinpointhq.com", "rippling.com", "wellfound.com",
  "hired.com", "ziprecruiter.com", "indeed.com", "monster.com", "dice.com",
  "builtinnyc.com", "builtin.com", "angel.co",
]

const ATS_SENDER_PATTERNS = [
  "careers@", "jobs@", "hiring@", "recruiting@",
  "recruitment@", "talent@", "apply@",
]

function isAtsSender(from: string): boolean {
  const f = from.toLowerCase()
  return (
    ATS_SENDER_DOMAINS.some((d) => f.includes(d)) ||
    ATS_SENDER_PATTERNS.some((p) => f.includes(p))
  )
}

/**
 * Fast local pre-filter — no API call, no latency.
 *
 * Primary:   subject contains any job-related keyword → pass
 * Secondary: sender is a known ATS/job-board platform → pass
 * Otherwise: reject (never reaches the AI)
 */
export function isJobRelatedEmail(subject: string, from: string): boolean {
  const subjectLower = subject.toLowerCase()

  if (SUBJECT_KEYWORDS.some((kw) => subjectLower.includes(kw))) {
    return true
  }

  if (isAtsSender(from)) {
    return true
  }

  return false
}
