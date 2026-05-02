import Link from 'next/link';
import { FEATURE_COURSE_ID, STATIC_FALLBACK_DASHBOARD_COURSES } from '@/lib/canvas-demo';
import { loadSyncedDashboardCourses } from '@/lib/dashboard-courses-server';

const FEATURE_PILLS = [
  'Streaming RAG (OpenAI gpt-4o-mini)',
  'AI-graded short answers',
  'Practice quiz generator',
  'Canvas API ingestion',
  'Supabase pgvector + in-memory fallback',
  'PDF + Canvas page extraction',
];

export default async function DashboardPage() {
  const { courses, error, featuredCourseId } = await loadSyncedDashboardCourses();
  const highlightId = featuredCourseId ?? FEATURE_COURSE_ID;
  const fallbackName =
    STATIC_FALLBACK_DASHBOARD_COURSES.find((c) => c.id === highlightId)?.shortName ?? 'Featured course';

  const judgeSteps = [
    {
      number: '01',
      title: 'Open the featured course',
      body: `${fallbackName} is set up end-to-end: open it for modules, quizzes, and the study assistant.`,
      href: `/courses/${highlightId}`,
      cta: 'Open course →',
    },
    {
      number: '02',
      title: 'Try the Study Assistant',
      body: 'Ask anything about the course — answers stream in with inline citations [1] [2] linking back to the source material.',
      href: `/courses/${highlightId}/assistant`,
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
          {judgeSteps.map((step) => (
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

      {error ? (
        <div role="alert" className="mx-auto max-w-6xl rounded-lg border border-amber-300 bg-amber-50 px-6 py-4 text-sm text-amber-900">
          <p className="font-medium">Dashboard could not refresh from Canvas.</p>
          <p className="mt-1">{error}</p>
        </div>
      ) : null}

      <header className="ic-Dashboard-header">
        <div className="ic-Dashboard-header__title-row">
          <h2 className="ic-Dashboard-header__title">Dashboard</h2>
        </div>
      </header>
      <div id="DashboardCard_Container">
        <div className="ic-DashboardCard__box">
          {courses.map((course) => (
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
