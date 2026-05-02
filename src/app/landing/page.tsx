import Link from 'next/link';
import type { Metadata } from 'next';
import { FEATURE_COURSE_ID } from '@/lib/canvas-demo';

export const metadata: Metadata = {
  title: 'Vibeathon · Judges demo guide',
  description:
    'A guided tour of Vibeathon — the AI-powered Canvas LMS reimagining built for the ANU Build-a-thon.',
};

const ANU_LOGO =
  'https://instructure-uploads-apse2.s3.ap-southeast-2.amazonaws.com/account_268700000000000001/attachments/1294/Primary_Horizontal_GoldBlack_v2_200x200.png';

const STEPS = [
  {
    number: '01',
    title: 'Open the featured course',
    body: 'Computer Graphics (COMP4610) is fully ingested with real Canvas pages, PDFs, and assignment briefs — the richest place to see the assistant in action.',
    href: `/courses/${FEATURE_COURSE_ID}`,
    cta: 'Open Computer Graphics',
  },
  {
    number: '02',
    title: 'Try the Study Assistant',
    body: 'Ask anything about the course. Answers stream in live and include inline citations [1] [2] linking back to the exact source page or PDF.',
    href: `/courses/${FEATURE_COURSE_ID}/assistant`,
    cta: 'Open the assistant',
  },
  {
    number: '03',
    title: 'Generate a practice quiz',
    body: 'In the same assistant tool, generate 3–12 exam-style questions on any topic. Multiple choice is checked instantly; short answers are LLM-graded with a 0–1 score and feedback.',
    href: `/courses/${FEATURE_COURSE_ID}/assistant`,
    cta: 'Try the quiz generator',
  },
  {
    number: '04',
    title: 'See the import pipeline',
    body: 'The /admin control room imports any Canvas course end-to-end: pick weeks, watch real-time progress (queued → processing → ready), and inspect every processed file.',
    href: '/admin',
    cta: 'Open the admin import',
  },
];

const FEATURE_PILLS = [
  'Streaming RAG · OpenAI gpt-4o-mini',
  'AI-graded short answers',
  'Practice quiz generator',
  'Canvas API ingestion',
  'Supabase pgvector',
  'PDF + Canvas page extraction',
  'In-memory fallback store',
  'Next.js 14 App Router',
];

const SUGGESTED_PROMPTS = [
  'Explain the difference between flat shading and Phong shading with citations.',
  'Quiz me on transformation matrices — 5 multiple choice questions.',
  'Summarise what I need to do for the Project-2 report.',
];

export default function LandingPage() {
  return (
    <main className="landing">
      <div className="landing__bg" aria-hidden />

      <header className="landing__topbar">
        <Link href="/landing" className="landing__brand">
          <img src={ANU_LOGO} alt="ANU" />
          <span>Vibeathon</span>
        </Link>
        <nav className="landing__topnav" aria-label="Primary">
          <a href="#what-it-is">What it is</a>
          <a href="#demo">Guided demo</a>
          <a href="#stack">Tech</a>
          <Link href="/" className="landing__topnav-cta">
            Launch the app →
          </Link>
        </nav>
      </header>

      <section className="landing__hero">
        <p className="landing__eyebrow">For the judges · ANU Build-a-thon 2026</p>
        <h1 className="landing__headline">
          A Canvas LMS that <span>actually</span> studies with you.
        </h1>
        <p className="landing__lede">
          Vibeathon wraps a faithful Canvas LMS shell around a RAG-powered Study Assistant, an
          AI-graded practice quiz generator, and a live Canvas content import pipeline. Everything
          on this site is functional — pull the thread anywhere.
        </p>
        <div className="landing__hero-cta">
          <Link href={`/courses/${FEATURE_COURSE_ID}/assistant`} className="landing__btn landing__btn--primary">
            Start the demo →
          </Link>
          <Link href="/" className="landing__btn landing__btn--ghost">
            Skip to the dashboard
          </Link>
        </div>
        <ul className="landing__pills" aria-label="Capabilities">
          {FEATURE_PILLS.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>

      <section id="what-it-is" className="landing__section">
        <p className="landing__kicker">What it is</p>
        <h2 className="landing__h2">Three products, one cohesive Canvas-shaped UI.</h2>
        <div className="landing__cards">
          <article className="landing__card">
            <h3>Study Assistant</h3>
            <p>
              Streaming RAG over every imported Canvas page, PDF, and assignment brief. Answers
              cite the exact source — no hallucinated weeks, no made-up readings.
            </p>
          </article>
          <article className="landing__card">
            <h3>Practice quiz generator</h3>
            <p>
              Generate exam-style multiple choice or short-answer questions on any topic. Short
              answers are graded by a second OpenAI call that returns a 0–1 score and feedback.
            </p>
          </article>
          <article className="landing__card">
            <h3>Admin import control room</h3>
            <p>
              Select any Canvas course, preview its weeks, trigger a selective or full import.
              Live status bar polls every 3 seconds: queued → processing → ready.
            </p>
          </article>
        </div>
      </section>

      <section id="demo" className="landing__section landing__section--steps">
        <p className="landing__kicker">Guided demo · ~4 minutes</p>
        <h2 className="landing__h2">What to try, in order.</h2>
        <ol className="landing__steps">
          {STEPS.map((step) => (
            <li key={step.number} className="landing__step">
              <span className="landing__step-num" aria-hidden="true">
                {step.number}
              </span>
              <div className="landing__step-body">
                <h3>{step.title}</h3>
                <p>{step.body}</p>
                <Link href={step.href} className="landing__step-cta">
                  {step.cta} →
                </Link>
              </div>
            </li>
          ))}
        </ol>

        <aside className="landing__prompts">
          <p className="landing__prompts-label">Try asking the assistant:</p>
          <ul>
            {SUGGESTED_PROMPTS.map((p) => (
              <li key={p}>“{p}”</li>
            ))}
          </ul>
        </aside>
      </section>

      <section id="stack" className="landing__section landing__section--alt">
        <p className="landing__kicker">Under the hood</p>
        <h2 className="landing__h2">Boring tech, sharp execution.</h2>
        <div className="landing__stack">
          <div>
            <h4>Frontend</h4>
            <p>Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, react-markdown.</p>
          </div>
          <div>
            <h4>AI</h4>
            <p>OpenAI gpt-4o-mini for chat &amp; grading, text-embedding-3-small for retrieval.</p>
          </div>
          <div>
            <h4>Data</h4>
            <p>Supabase Postgres + pgvector. Falls back to an in-memory store when keys are absent.</p>
          </div>
          <div>
            <h4>Ingestion</h4>
            <p>Canvas REST API → pdf-parse → chunked &amp; embedded → cited at query time.</p>
          </div>
        </div>
      </section>

      <footer className="landing__footer">
        <div>
          <strong>Vibeathon</strong>
          <span>Built for the ANU Build-a-thon · 2026</span>
        </div>
        <div className="landing__footer-links">
          <Link href="/">Dashboard</Link>
          <Link href={`/courses/${FEATURE_COURSE_ID}/assistant`}>Assistant</Link>
          <Link href="/admin">Admin</Link>
          <a href="https://github.com/HarryRandall/vibeathon" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
      </footer>
    </main>
  );
}
