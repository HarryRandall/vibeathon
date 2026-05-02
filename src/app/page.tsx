import Link from 'next/link';
import { DASHBOARD_COURSES } from '@/lib/canvas-demo';

export default function DashboardPage() {
  return (
    <>
      <h1 className="screenreader-only">Dashboard</h1>
      <div id="announcementWrapper" />
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
