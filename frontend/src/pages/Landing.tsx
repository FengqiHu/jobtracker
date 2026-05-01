import { Link } from "react-router-dom"

function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[rgba(34,42,53,0.06)] bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-container items-center justify-between px-6">
        <span className="font-display text-lg font-semibold text-[#242424]">Job Tracker</span>
        <nav className="flex items-center gap-3">
          <Link
            to="/login"
            className="rounded-full px-4 py-1.5 text-sm font-medium text-[#898989] transition-colors hover:text-[#242424]"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="rounded-full bg-[#242424] px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-80"
          >
            Get started
          </Link>
        </nav>
      </div>
    </header>
  )
}

function HeroSection() {
  return (
    <section className="flex flex-col items-center px-6 pb-24 pt-36 text-center">
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[rgba(34,42,53,0.1)] bg-[#f6f6f6] px-3 py-1">
        <span className="h-1.5 w-1.5 rounded-full bg-[#242424]" />
        <span className="text-xs font-medium text-[#898989]">AI-powered · Open source · Self-hosted</span>
      </div>

      <h1 className="mx-auto max-w-3xl text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.05] tracking-tight text-[#111111]">
        Track every application,<br />automatically.
      </h1>

      <p className="mx-auto mt-6 max-w-xl text-[1.0625rem] leading-7 text-[#898989]">
        Connect your inbox and let AI do the rest. Job Tracker reads your emails, extracts company
        names, roles, and status updates, and keeps your entire pipeline organised — without you
        lifting a finger.
      </p>

      <div className="mt-10 flex items-center gap-3">
        <Link
          to="/register"
          className="rounded-full bg-[#242424] px-6 py-2.5 text-sm font-semibold text-white shadow-inset transition-opacity hover:opacity-80"
        >
          Get started free
        </Link>
        <Link
          to="/login"
          className="rounded-full border border-[rgba(34,42,53,0.12)] bg-white px-6 py-2.5 text-sm font-semibold text-[#242424] shadow-soft transition-colors hover:bg-[#f6f6f6]"
        >
          Sign in
        </Link>
      </div>
    </section>
  )
}

const FEATURES = [
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
      </svg>
    ),
    title: "AI email parsing",
    body: "Connects to your inbox and uses AI to identify job-related emails, then extracts the company, role, and application status with a confidence score."
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
      </svg>
    ),
    title: "Multiple email providers",
    body: "Works with Gmail via OAuth, standard IMAP accounts, and Microsoft Outlook with XOAUTH2 — connect as many accounts as you need."
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    ),
    title: "Interview calendar",
    body: "Automatically detects interview invitations and lets you sync scheduled interviews to Google Calendar, with reminders and location details."
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
      </svg>
    ),
    title: "Kanban & table views",
    body: "Visualise your pipeline in a Kanban board or a sortable table. Filter by status, search by company or role, and update statuses in one click."
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
    ),
    title: "Automatic background sync",
    body: "A built-in scheduler silently checks for new emails every 15 minutes (configurable). Your pipeline stays current without you ever having to refresh."
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
    ),
    title: "Encrypted credentials",
    body: "OAuth tokens and IMAP passwords are encrypted with AES-256-GCM before being written to the database. Your credentials never leave your machine in plain text."
  }
]

function FeaturesSection() {
  return (
    <section className="px-6 pb-24">
      <div className="mx-auto max-w-container">
        <div className="mb-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8a8a8a]">Features</p>
        </div>
        <h2 className="mb-12 text-center text-[2rem] leading-tight">
          Everything you need, nothing you don't.
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-[20px] border border-[rgba(34,42,53,0.08)] bg-white p-6 shadow-card"
            >
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#f6f6f6] text-[#242424]">
                {f.icon}
              </div>
              <h3 className="mb-1.5 text-base font-semibold text-[#242424]">{f.title}</h3>
              <p className="text-sm leading-6 text-[#898989]">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const STEPS = [
  {
    n: "1",
    title: "Create an account",
    body: "Sign up with a username and password, or with your Google account."
  },
  {
    n: "2",
    title: "Connect your inbox",
    body: "Add a Gmail account via OAuth or any IMAP mailbox. An initial scan covers the past 90 days of email automatically."
  },
  {
    n: "3",
    title: "Watch your pipeline fill",
    body: "Job Tracker finds application emails, extracts the details, and keeps everything up to date as new emails arrive."
  }
]

function HowItWorksSection() {
  return (
    <section className="px-6 pb-24">
      <div className="mx-auto max-w-container">
        <div className="mb-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8a8a8a]">How it works</p>
        </div>
        <h2 className="mb-12 text-center text-[2rem] leading-tight">
          Up and running in three steps.
        </h2>

        <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="rounded-[20px] border border-[rgba(34,42,53,0.08)] bg-white p-6 shadow-card"
            >
              <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#242424] text-xs font-bold text-white">
                {s.n}
              </div>
              <h3 className="mb-1.5 text-base font-semibold text-[#242424]">{s.title}</h3>
              <p className="text-sm leading-6 text-[#898989]">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CtaSection() {
  return (
    <section className="px-6 pb-24">
      <div className="mx-auto max-w-container">
        <div className="rounded-[24px] bg-[#242424] px-8 py-16 text-center shadow-card">
          <h2 className="text-[2rem] leading-tight text-white">
            Stop losing track of applications.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[rgba(255,255,255,0.6)]">
            Connect your inbox once and let Job Tracker handle the rest. Free, open source, and
            your data stays on your machine.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              to="/register"
              className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-[#242424] transition-opacity hover:opacity-90"
            >
              Get started free
            </Link>
            <Link
              to="/login"
              className="rounded-full border border-[rgba(255,255,255,0.2)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:border-[rgba(255,255,255,0.4)]"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-[rgba(34,42,53,0.06)] px-6 py-8">
      <div className="mx-auto flex max-w-container items-center justify-between">
        <span className="font-display text-sm font-semibold text-[#242424]">Job Tracker</span>
        <p className="text-xs text-[#898989]">Open source · MIT license</p>
      </div>
    </footer>
  )
}

export default function Landing() {
  return (
    <div className="min-h-screen">
      <Nav />
      <main>
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <CtaSection />
      </main>
      <Footer />
    </div>
  )
}
