import Link from 'next/link';
import { loadSyncedDashboardCourses } from '@/lib/dashboard-courses-server';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { courses, error } = await loadSyncedDashboardCourses();

  return (
    <>
      <div id="announcementWrapper" />

      {error ? (
        <div role="alert" className="mx-auto max-w-6xl rounded-lg border border-amber-300 bg-amber-50 px-6 py-4 text-sm text-amber-900">
          <p className="font-medium">Dashboard could not refresh from Canvas.</p>
          <p className="mt-1">{error}</p>
        </div>
      ) : null}

      <header className="ic-Dashboard-header">
        <div className="ic-Dashboard-header__title-row">
          <h1 className="ic-Dashboard-header__title">Dashboard</h1>
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
