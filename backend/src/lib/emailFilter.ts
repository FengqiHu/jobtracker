/**
 * Subjects that indicate JOB ADVERTISEMENTS — checked FIRST, before any positive match.
 * These are mass-marketing emails from job boards / recommendation engines,
 * NOT status updates about an active application.
 * A match here causes immediate rejection (never reaches the AI).
 */
const AD_SUBJECT_PATTERNS = [
  // Job recommendation / alert digests
  "job alert",
  "jobs alert",
  "new jobs for",
  "jobs for you",
  "jobs you might",
  "job recommendations",
  "recommended jobs",
  "jobs matching",
  "matching jobs",
  "jobs based on",
  "jobs that match",
  "suggested jobs",
  "similar jobs",
  "jobs near",
  "jobs picked for",
  "curated jobs",
  "featured jobs",
  "top jobs",
  "jobs in your area",
  // Digest / newsletter formats
  "weekly jobs",
  "daily jobs",
  "job digest",
  "weekly digest",
  "daily digest",
  "new opportunities for you",
  "jobs we think you",
  // Promotional
  "get hired faster",
  "apply now to",
  "see all jobs",
  "browse jobs",
]

/**
 * Sender domains that ONLY send job advertisements (never application status updates).
 * Emails from these senders are rejected regardless of subject.
 */
const AD_SENDER_DOMAINS = [
  "jobright.ai",
  "jobalert",
  "talentrise",
  "careerbuilder.com",
  "simplyhired.com",
  "glassdoor.com",
]

/**
 * Subject keywords — the POSITIVE filter for application-specific emails.
 * Only kept phrases that are strongly correlated with actual application status
 * updates (confirmation, interview, offer, rejection). Broad terms that frequently
 * appear in job-ad newsletters have been removed.
 */
const SUBJECT_KEYWORDS = [
  // Application received / confirmed
  "thank you for applying",
  "thank you for your application",
  "we received your application",
  "your application to",
  "your application for",
  "your job application",
  "application received",
  "application submitted",
  "application confirmed",
  "application under review",
  "application is under review",
  "application status",
  "application update",
  "you applied",
  "we've received your",
  // Interview — broad but high-value; ad patterns catch newsletter variants above
  "interview",
  "phone screen",
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
  "not be proceeding",
  // Recruiter outreach (individual, not mass-marketing)
  "i came across your profile",
  "your candidacy",
  "talent acquisition",
  // Post-offer / onboarding
  "background check",
  "reference check",
]

/**
 * True ATS platforms — these send emails only when the user has an active application.
 * Job boards that also send mass job-ad emails have been removed from this list
 * (their application confirmation emails are still caught via subject keywords above).
 */
const ATS_SENDER_DOMAINS = [
  "greenhouse.io", "lever.co", "workday.com", "myworkdayjobs.com",
  "smartrecruiters.com", "bamboohr.com", "icims.com", "taleo.net",
  "jobvite.com", "successfactors.com", "ashbyhq.com", "breezy.hr",
  "recruitee.com", "workable.com", "teamtailor.com", "personio.com",
  "comeet.com", "pinpointhq.com", "rippling.com",
  // College/early-career recruiting platforms
  "handshake.com", "joinhandshake.com",
]

const ATS_SENDER_PATTERNS = [
  "careers@", "jobs@", "hiring@", "recruiting@",
  "recruitment@", "talent@", "apply@",
]

function isAdEmail(subject: string, from: string): boolean {
  const subjectLower = subject.toLowerCase()
  const fromLower = from.toLowerCase()

  if (AD_SUBJECT_PATTERNS.some((p) => subjectLower.includes(p))) {
    return true
  }

  if (AD_SENDER_DOMAINS.some((d) => fromLower.includes(d))) {
    return true
  }

  return false
}

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
 * Step 1: Reject if the email looks like a job advertisement (ad blocklist).
 * Step 2: Pass if the subject contains an application-specific keyword.
 * Step 3: Pass if the sender is a known ATS platform.
 * Otherwise: reject.
 */
export function isJobRelatedEmail(subject: string, from: string): boolean {
  // Ad check must come first — it short-circuits even ATS senders that send bulk ads.
  if (isAdEmail(subject, from)) {
    return false
  }

  const subjectLower = subject.toLowerCase()

  if (SUBJECT_KEYWORDS.some((kw) => subjectLower.includes(kw))) {
    return true
  }

  if (isAtsSender(from)) {
    return true
  }

  return false
}
