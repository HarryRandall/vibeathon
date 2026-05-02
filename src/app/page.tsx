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
          {DASHBOARD_COURSES.map((c) => (
            <Link key={c.id} href={`/courses/${c.id}`} className="ic-DashboardCard">
              <div
                className="ic-DashboardCard__header"
                style={{
                  background: c.image ? `url(${c.image}) center/cover` : c.color ?? '#324A4D',
                }}
              />
              <div className="ic-DashboardCard__content">
                <p className="ic-DashboardCard__course-code">{c.courseCode}</p>
                <h3 className="ic-DashboardCard__course-name">{c.shortName}</h3>
                <p className="ic-DashboardCard__meta">{c.term}</p>
                <p className="ic-DashboardCard__subtitle">{c.subtitle}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
