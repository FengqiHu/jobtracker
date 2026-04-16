// Keywords found in subjects of job-related emails
const SUBJECT_KEYWORDS = [
  // Application stage
  "application", "applied", "apply", "applying",
  "we received your", "thank you for applying", "thank you for your application",
  // Interview stage
  "interview", "interviewing", "phone screen", "screening", "technical assessment",
  "coding challenge", "take-home", "take home", "hiring assessment", "skills assessment",
  // Offer / rejection
  "offer", "offer letter", "job offer", "offer of employment",
  "rejected", "rejection", "unfortunately", "not moving forward",
  "other candidates", "different direction", "filled the position",
  "regret to inform", "not selected", "not be moving",
  // General job signals
  "position", "opening", "vacancy", "role", "opportunity",
  "recruiter", "recruiting", "recruitment", "talent acquisition",
  "background check", "reference check", "onboarding",
  "hiring", "next steps", "your candidacy",
]

// Keywords/domains found in senders of job-related emails
const SENDER_KEYWORDS = [
  // ATS platforms
  "greenhouse.io", "lever.co", "workday.com", "smartrecruiters.com",
  "bamboohr.com", "icims.com", "taleo.net", "jobvite.com",
  "myworkdayjobs.com", "successfactors.com", "ashbyhq.com",
  "breezy.hr", "jazz.co", "recruitee.com", "workable.com",
  "teamtailor.com", "personio.com", "comeet.com", "pinpointhq.com",
  "rippling.com", "gusto.com", "merge.dev",
  // Job boards
  "linkedin.com", "indeed.com", "glassdoor.com", "ziprecruiter.com",
  "monster.com", "dice.com", "hired.com", "wellfound.com", "angel.co",
  "builtinnyc.com", "builtin.com",
  // Generic sender name/address patterns
  "recruit", "talent", "careers@", "jobs@", "hiring@", "hr@",
  "noreply@", "no-reply@", "notifications@", "staffing", "headhunter",
]

/**
 * Fast local check — no API call, no latency.
 * Returns true if subject or sender contains signals of a job-related email.
 * Errs on the side of inclusion: false positives are fine because the AI
 * parser (step 2) will reject them with a low-confidence result.
 */
export function isJobRelatedEmail(subject: string, from: string): boolean {
  const subjectLower = subject.toLowerCase()
  const fromLower = from.toLowerCase()

  for (const kw of SUBJECT_KEYWORDS) {
    if (subjectLower.includes(kw)) return true
  }

  for (const kw of SENDER_KEYWORDS) {
    if (fromLower.includes(kw)) return true
  }

  return false
}
