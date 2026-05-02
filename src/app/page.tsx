import Link from 'next/link';
import { DASHBOARD_COURSES, FEATURE_COURSE_ID } from '@/lib/canvas-demo';

const JUDGE_STEPS = [
  {
    number: '01',
    title: 'Open the featured course',
    body: 'Computer Graphics (COMP4610) is fully ingested with real Canvas pages, PDFs, and assignment briefs.',
    href: `/courses/${FEATURE_COURSE_ID}`,
    cta: 'Open course →',
  },
  {
    number: '02',
    title: 'Try the Study Assistant',
    body: 'Ask anything about the course — answers stream in with inline citations [1] [2] linking back to the source material.',
    href: `/courses/${FEATURE_COURSE_ID}/assistant`,
    cta: 'Open assistant →',
  },
  {
    number: '03',
    title: 'See the import pipeline',
    body: 'The /admin page imports any Canvas course end-to-end: select weeks, watch live progress, browse processed files.',
    href: '/admin',
    cta: 'Open admin →',
  },
];

const FEATURE_PILLS = [
  'Streaming RAG (OpenAI gpt-4o-mini)',
  'AI-graded short answers',
  'Practice quiz generator',
  'Canvas API ingestion',
  'Supabase pgvector + in-memory fallback',
  'PDF + Canvas page extraction',
];

export default function DashboardPage() {
  return (
    <>
      <h1 className="screenreader-only">Dashboard</h1>
      <div id="announcementWrapper" />

      <section className="judge-guide" aria-labelledby="judge-guide-title">
        <div className="judge-guide__intro">
          <p className="judge-guide__eyebrow">For the judges · ANU Build-a-thon 2026</p>
          <h2 id="judge-guide-title" className="judge-guide__title">
            Welcome to <span>Vibeathon</span>
          </h2>
          <p className="judge-guide__lede">
            A faithful Canvas LMS shell wrapped around a RAG-powered Study Assistant, AI-graded practice quizzes,
            and a live Canvas import pipeline. Everything below is functional — pick a course card to dive in,
            or follow the three steps for the guided demo.
          </p>
          <ul className="judge-guide__pills">
            {FEATURE_PILLS.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </div>

        <ol className="judge-guide__steps">
          {JUDGE_STEPS.map((step) => (
            <li key={step.number} className="judge-step">
              <span className="judge-step__number" aria-hidden="true">
                {step.number}
              </span>
              <div className="judge-step__body">
                <h3 className="judge-step__title">{step.title}</h3>
                <p className="judge-step__copy">{step.body}</p>
                <Link className="judge-step__cta" href={step.href}>
                  {step.cta}
                </Link>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <header className="ic-Dashboard-header">
        <div className="ic-Dashboard-header__title-row">
          <h2 className="ic-Dashboard-header__title">Dashboard</h2>
        </div>
      </header>
      <div id="DashboardCard_Container">
        <div className="ic-DashboardCard__box">
          {DASHBOARD_COURSES.map((course) => (
            <Link key={course.id} href={`/courses/${course.id}`} className="ic-DashboardCard">
              <div
                className="ic-DashboardCard__header"
                style={{
                  background: course.image ? `url(${course.image}) center/cover` : course.color ?? '#324A4D',
                }}
              />
              <div className="ic-DashboardCard__content">
                <p className="ic-DashboardCard__course-code">{course.courseCode}</p>
                <h3 className="ic-DashboardCard__course-name">{course.shortName}</h3>
                <p className="ic-DashboardCard__meta">{course.term}</p>
                <p className="ic-DashboardCard__subtitle">{course.subtitle}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
