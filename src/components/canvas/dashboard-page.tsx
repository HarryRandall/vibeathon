import Link from 'next/link';
import type { DashboardCourseCard } from '@/lib/canvas-demo';
import type { TodoItem } from '@/lib/dummy-data';

function buildCardAccent(course: DashboardCourseCard) {
  return course.image
    ? `linear-gradient(180deg, rgba(11, 15, 18, 0.08), rgba(11, 15, 18, 0.62)), url(${course.image}) center/cover`
    : `linear-gradient(145deg, ${course.color ?? '#324A4D'}, color-mix(in srgb, ${course.color ?? '#324A4D'} 58%, #f1ede5))`;
}

export function DashboardPageView({
  courses,
  todos,
}: {
  courses: DashboardCourseCard[];
  todos: TodoItem[];
}) {
  return (
    <>
      <h1 className="screenreader-only">Dashboard</h1>
      <div id="announcementWrapper" />
      <section className="ic-Dashboard-header canvas-dashboard-hero">
        <div className="canvas-dashboard-hero__copy">
          <p className="canvas-dashboard-hero__eyebrow">Student workspace</p>
          <div className="ic-Dashboard-header__title-row canvas-dashboard-hero__title-row">
            <div>
              <h2 className="ic-Dashboard-header__title">Dashboard</h2>
              <p className="canvas-dashboard-hero__summary">
                Your active courses, upcoming work, and course entry points are rendered from shared data instead of page-specific markup.
              </p>
            </div>
            <div className="canvas-dashboard-hero__stats">
              <div className="canvas-dashboard-stat">
                <span className="canvas-dashboard-stat__value">{courses.length}</span>
                <span className="canvas-dashboard-stat__label">Courses</span>
              </div>
              <div className="canvas-dashboard-stat">
                <span className="canvas-dashboard-stat__value">{todos.length}</span>
                <span className="canvas-dashboard-stat__label">To do</span>
              </div>
            </div>
          </div>
        </div>
      </section>
      <div id="DashboardCard_Container">
        <div className="ic-DashboardCard__box">
          {courses.map((course) => {
            const relatedTodos = todos.filter((todo) => todo.href.includes(`/courses/${course.id}`));
            return (
              <Link key={course.id} href={`/courses/${course.id}`} className="ic-DashboardCard canvas-dashboard-card">
                <div className="ic-DashboardCard__header canvas-dashboard-card__header" style={{ background: buildCardAccent(course) }}>
                  <span className="canvas-dashboard-card__term">{course.term}</span>
                  <span className="canvas-dashboard-card__course-code-top">{course.courseCode}</span>
                </div>
                <div className="ic-DashboardCard__content canvas-dashboard-card__content">
                  <h3 className="ic-DashboardCard__course-name canvas-dashboard-card__title">{course.shortName}</h3>
                  <p className="ic-DashboardCard__subtitle canvas-dashboard-card__subtitle">{course.subtitle}</p>
                  <div className="canvas-dashboard-card__footer">
                    <span className="canvas-dashboard-card__badge">{relatedTodos.length} upcoming</span>
                    <span className="canvas-dashboard-card__hint">Open course</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
