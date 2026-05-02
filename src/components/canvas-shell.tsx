'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';
import {
  IconCalendar,
  IconCourses,
  IconDashboard,
  IconGroups,
  IconHelp,
  IconHistory,
  IconInbox,
  IconNavToggle,
  IconStudio,
} from '@/components/canvas/canvas-icons';
import { courseHref, DASHBOARD_COURSES, FEATURE_COURSE_ID } from '@/lib/canvas-demo';
import { buildCourseSectionTabs } from '@/lib/course-content';
import { DEMO_GROUPS, DEMO_TODOS } from '@/lib/dummy-data';

const ANU_HEADER_LOGO =
  'https://instructure-uploads-apse2.s3.ap-southeast-2.amazonaws.com/account_268700000000000001/attachments/1294/Primary_Horizontal_GoldBlack_v2_200x200.png';

const CANVAS_AVATAR_PLACEHOLDER = 'https://canvas.anu.edu.au/images/messages/avatar-50.png';

const TERM_LABEL = 'First Semester, 2026';

function sectionTabActive(pathname: string, href: string) {
  const isCourseHome = /^\/courses\/[^/]+$/.test(href);
  if (isCourseHome) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function globalPageTitle(pathname: string): string {
  if (pathname.startsWith('/profile')) return 'Account';
  if (pathname.startsWith('/calendar')) return 'Calendar';
  if (pathname.startsWith('/groups')) return 'Groups';
  if (pathname.startsWith('/inbox')) return 'Inbox';
  if (pathname.startsWith('/history')) return 'History';
  if (pathname.startsWith('/studio')) return 'Studio';
  if (pathname.startsWith('/help')) return 'Help';
  if (pathname.startsWith('/admin')) return 'Admin upload';
  return 'Page';
}

export default function CanvasShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [courseMenuOpen, setCourseMenuOpen] = useState(true);

  const toggleCourseMenu = useCallback(() => {
    setCourseMenuOpen((o) => !o);
  }, []);

  const isDashboard = pathname === '/';
  const activeCourseId = useMemo(() => {
    const m = pathname.match(/^\/courses\/([^/]+)/);
    return m?.[1] ?? null;
  }, [pathname]);
  const isCourseShell = Boolean(activeCourseId);
  const isGlobalShell = !isDashboard && !isCourseShell;

  const sectionTabs = useMemo(
    () => (activeCourseId ? buildCourseSectionTabs(activeCourseId) : []),
    [activeCourseId],
  );

  const displayCourseCode =
    DASHBOARD_COURSES.find((c) => c.id === activeCourseId)?.courseCode ?? 'COMP4610/COMP8610';

  const globalTitle = globalPageTitle(pathname);

  const mobileTitle = isDashboard
    ? 'Dashboard'
    : isCourseShell
      ? DASHBOARD_COURSES.find((c) => c.id === activeCourseId)?.courseCode ?? 'Course'
      : globalTitle;

  const navDash = isDashboard;
  const navCourses = isCourseShell;
  const navCalendar = pathname.startsWith('/calendar');
  const navGroups = pathname.startsWith('/groups');
  const navInbox = pathname.startsWith('/inbox');
  const navProfile = pathname.startsWith('/profile');
  const navHistory = pathname.startsWith('/history');
  const navStudio = pathname.startsWith('/studio');
  const navHelp = pathname.startsWith('/help');

  const courseTodos = useMemo(
    () => DEMO_TODOS.filter((t) => t.courseCode === displayCourseCode || t.href.includes(`/courses/${activeCourseId}`)),
    [displayCourseCode, activeCourseId],
  );
  const sidebarTodos = courseTodos.length ? courseTodos : DEMO_TODOS.slice(0, 3);

  return (
    <div id="application" className="ic-app">
      <header id="mobile-header" className="no-print">
        <button type="button" className="mobile-nav-btn" aria-label="Global Navigation Menu">
          <span className="icon-hamburger-bar icon-hamburger-bar--light" />
          <span className="icon-hamburger-bar icon-hamburger-bar--light" />
          <span className="icon-hamburger-bar icon-hamburger-bar--light" />
        </button>
        <div className="mobile-header-title truncate">{mobileTitle}</div>
        <button type="button" className="mobile-nav-btn" aria-label="Navigation Menu" onClick={toggleCourseMenu}>
          ▾
        </button>
      </header>

      <header id="header" className="ic-app-header no-print" aria-label="Global Header">
        <a href="#content" id="skip_navigation_link">
          Skip To Content
        </a>
        <div role="region" className="ic-app-header__main-navigation" aria-label="Global Navigation">
          <div className="ic-app-header__logomark-container">
            <Link href="/" className="ic-app-header__logomark">
              <span className="screenreader-only">Dashboard</span>
              <img src={ANU_HEADER_LOGO} alt="" width={120} height={40} />
            </Link>
          </div>
          <ul id="menu" className="ic-app-header__menu-list">
            <li className={`menu-item ic-app-header__menu-list-item ${navProfile ? 'ic-app-header__menu-list-item--active' : ''}`}>
              <Link id="global_nav_profile_link" href="/profile" className="ic-app-header__menu-list-link">
                <div className="menu-item-icon-container">
                  <div aria-hidden className="fs-exclude ic-avatar">
                    <img src={CANVAS_AVATAR_PLACEHOLDER} alt="Account" />
                  </div>
                  <span className="menu-item__badge" />
                </div>
                <div className="menu-item__text">Account</div>
              </Link>
            </li>
            <li className={`ic-app-header__menu-list-item ${navDash ? 'ic-app-header__menu-list-item--active' : ''}`}>
              <Link id="global_nav_dashboard_link" href="/" className="ic-app-header__menu-list-link" aria-current={navDash ? 'page' : undefined}>
                <div className="menu-item-icon-container" aria-hidden>
                  <IconDashboard className="ic-icon-svg ic-icon-svg--dashboard" />
                </div>
                <div className="menu-item__text">Dashboard</div>
              </Link>
            </li>
            <li className={`menu-item ic-app-header__menu-list-item ${navCourses ? 'ic-app-header__menu-list-item--active' : ''}`}>
              <Link
                id="global_nav_courses_link"
                href={`/courses/${FEATURE_COURSE_ID}`}
                className="ic-app-header__menu-list-link"
                aria-current={navCourses ? 'page' : undefined}
              >
                <div className="menu-item-icon-container" aria-hidden>
                  <IconCourses className="ic-icon-svg ic-icon-svg--courses" />
                </div>
                <div className="menu-item__text">Courses</div>
              </Link>
            </li>
            <li className={`menu-item ic-app-header__menu-list-item ${navGroups ? 'ic-app-header__menu-list-item--active' : ''}`}>
              <Link id="global_nav_groups_link" href="/groups" className="ic-app-header__menu-list-link">
                <div className="menu-item-icon-container" aria-hidden>
                  <IconGroups className="ic-icon-svg ic-icon-svg--groups" />
                </div>
                <div className="menu-item__text">Groups</div>
              </Link>
            </li>
            <li className={`menu-item ic-app-header__menu-list-item ${navCalendar ? 'ic-app-header__menu-list-item--active' : ''}`}>
              <Link id="global_nav_calendar_link" href="/calendar" className="ic-app-header__menu-list-link">
                <div className="menu-item-icon-container" aria-hidden>
                  <IconCalendar className="ic-icon-svg ic-icon-svg--calendar" />
                </div>
                <div className="menu-item__text">Calendar</div>
              </Link>
            </li>
            <li className={`menu-item ic-app-header__menu-list-item ${navInbox ? 'ic-app-header__menu-list-item--active' : ''}`}>
              <Link id="global_nav_conversations_link" href="/inbox" className="ic-app-header__menu-list-link">
                <div className="menu-item-icon-container">
                  <IconInbox className="ic-icon-svg ic-icon-svg--inbox" />
                  <span className="menu-item__badge" />
                </div>
                <div className="menu-item__text">Inbox</div>
              </Link>
            </li>
            <li className={`menu-item ic-app-header__menu-list-item ${navHistory ? 'ic-app-header__menu-list-item--active' : ''}`}>
              <Link id="global_nav_history_link" href="/history" className="ic-app-header__menu-list-link">
                <div className="menu-item-icon-container" aria-hidden>
                  <IconHistory className="ic-icon-svg menu-item__icon svg-icon-history" />
                </div>
                <div className="menu-item__text">History</div>
              </Link>
            </li>
            <li className={`globalNavExternalTool menu-item ic-app-header__menu-list-item ${navStudio ? 'ic-app-header__menu-list-item--active' : ''}`}>
              <Link className="ic-app-header__menu-list-link" href="/studio">
                <div className="menu-item-icon-container" aria-hidden>
                  <IconStudio className="ic-icon-svg ic-icon-svg--lti menu-item__icon" />
                </div>
                <div className="menu-item__text">Studio</div>
              </Link>
            </li>
            <li className={`ic-app-header__menu-list-item ${navHelp ? 'ic-app-header__menu-list-item--active' : ''}`}>
              <Link id="global_nav_help_link" href="/help" className="ic-app-header__menu-list-link">
                <div className="menu-item-icon-container" role="presentation">
                  <IconHelp className="ic-icon-svg menu-item__icon svg-icon-help" />
                  <span className="menu-item__badge" />
                </div>
                <div className="menu-item__text">Help</div>
              </Link>
            </li>
          </ul>
        </div>
        <div className="ic-app-header__secondary-navigation">
          <ul className="ic-app-header__menu-list">
            <li className="menu-item ic-app-header__menu-list-item">
              <a
                id="primaryNavToggle"
                role="button"
                href="#"
                className="ic-app-header__menu-list-link ic-app-header__menu-list-link--nav-toggle"
                aria-label="Minimise global navigation"
                title="Minimise global navigation"
              >
                <div className="menu-item-icon-container" aria-hidden>
                  <IconNavToggle className="ic-icon-svg ic-icon-svg--navtoggle" />
                </div>
              </a>
            </li>
          </ul>
        </div>
      </header>

      <div id="wrapper" className="ic-Layout-wrapper">
        {!isDashboard && (
          <div className="ic-app-nav-toggle-and-crumbs no-print">
            {isCourseShell && (
              <button
                type="button"
                id="courseMenuToggle"
                className="ic-app-course-nav-toggle"
                aria-live="polite"
                aria-label={courseMenuOpen ? 'Hide Courses Navigation Menu' : 'Show Courses Navigation Menu'}
                onClick={toggleCourseMenu}
              >
                <span className="icon-hamburger-bar" />
                <span className="icon-hamburger-bar" />
                <span className="icon-hamburger-bar" />
              </button>
            )}
            {!isCourseShell && <span className="ic-app-nav-toggle-spacer" aria-hidden />}

            <div className="ic-app-crumbs ic-app-crumbs-enhanced-rubrics">
              <nav id="breadcrumbs" role="navigation" aria-label="breadcrumbs">
                <ol>
                  <li className="home">
                    <Link href="/">
                      <span className="ellipsible">
                        <span className="screenreader-only">My Dashboard</span>
                        <span aria-hidden>🏠</span>
                      </span>
                    </Link>
                  </li>
                  {isCourseShell ? (
                    <li id="crumb_course_demo" aria-current="page">
                      <Link href={activeCourseId ? `/courses/${activeCourseId}` : '/'}>
                        <span className="ellipsible">{displayCourseCode}</span>
                      </Link>
                    </li>
                  ) : (
                    <li aria-current="page">
                      <span className="ellipsible">{globalTitle}</span>
                    </li>
                  )}
                </ol>
              </nav>
            </div>
          </div>
        )}

        <div id="main" className={`ic-Layout-columns ${isDashboard ? 'ic-Layout-columns--dashboard' : ''}`}>
          <div className="ic-Layout-watermark" aria-hidden />

          {isCourseShell && (
            <div id="left-side" className={`ic-app-course-menu ic-sticky-on list-view ${courseMenuOpen ? '' : 'collapsed'}`}>
              <div id="sticky-container" className="ic-sticky-frame">
                <span id="section-tabs-header-subtitle" className="ellipsis">
                  {TERM_LABEL}
                </span>
                <nav role="navigation" aria-label="Courses Navigation Menu">
                  <ul id="section-tabs">
                    {sectionTabs.map((tab) => {
                      const active = sectionTabActive(pathname, tab.href);
                      return (
                        <li key={tab.href} className="section">
                          <Link href={tab.href} className={active ? 'active' : undefined} aria-current={active ? 'page' : undefined}>
                            {tab.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              </div>
            </div>
          )}

          <div id="not_right_side" className="ic-app-main-content">
            <div id="content-wrapper" className="ic-Layout-contentWrapper">
              <div id="content" className="ic-Layout-contentMain" role="main">
                {isDashboard ? (
                  <div id="dashboard" className="ic-dashboard-app">
                    {children}
                  </div>
                ) : isCourseShell ? (
                  <div id="course_home_content">
                    <div id="wiki_page_show">{children}</div>
                  </div>
                ) : (
                  <div id="global_content" className="ic-global-main">
                    <div id="wiki_page_show">{children}</div>
                  </div>
                )}
              </div>
            </div>

            <div id="right-side-wrapper" className="ic-app-main-content__secondary">
              <aside id="right-side" role="complementary">
                {(isDashboard || isGlobalShell) && (
                  <div className="ic-sidebar-todo-block">
                    <h2 className="ic-sidebar-h2">To Do</h2>
                    <ul className="ic-todo-list">
                      {DEMO_TODOS.map((t) => (
                        <li key={t.id} className="ic-todo-item">
                          <Link href={t.href} className="ic-todo-link">
                            <span className="ic-todo-course">{t.courseCode}</span>
                            <span className="ic-todo-title">{t.title}</span>
                            <span className="ic-todo-meta">
                              {t.dueLabel} · {t.points} pts
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <p className="ic-sidebar-note">Demo data — connect Canvas API for live assignments.</p>
                  </div>
                )}

                {isCourseShell && (
                  <div id="course_show_secondary">
                    <div className="course-options">
                      <Link id="view_course_stream_btn" className="btn button-sidebar-wide" href={`/courses/${activeCourseId}/announcements`}>
                        View Course Stream
                      </Link>
                    </div>
                    <Link className="btn button-sidebar-wide" href="/calendar">
                      View Course Calendar
                    </Link>
                    <Link id="view_course_notifications_btn" className="btn button-sidebar-wide" href={`/courses/${activeCourseId}/announcements`}>
                      View Course Notifications
                    </Link>

                    <h2 className="ic-sidebar-h2">To Do</h2>
                    <ul className="ic-todo-list">
                      {sidebarTodos.map((t) => (
                        <li key={t.id} className="ic-todo-item">
                          <Link href={t.href} className="ic-todo-link">
                            <span className="ic-todo-title">{t.title}</span>
                            <span className="ic-todo-meta">{t.dueLabel}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>

                    <h2 className="ic-sidebar-h2">Course Groups</h2>
                    <ul className="unstyled_list group_list">
                      {DEMO_GROUPS.slice(0, 4).map((g) => (
                        <li key={g.id}>
                          <Link href={g.href}>{g.name}</Link>
                        </li>
                      ))}
                    </ul>

                    <div className="events_list recent_feedback">
                      <div className="h2 shared-space">
                        <h2>Recent Feedback</h2>
                      </div>
                      <ul className="right-side-list events">
                        <li className="event">
                          <Link href={`/courses/${FEATURE_COURSE_ID}/grades`} className="recent_feedback_icon">
                            <i className="icon-check">✓</i>
                            <div className="event-details">
                              <b className="event-details__title recent_feedback_title">C-Lab-2 submission site</b>
                              <p className="event-details__context">{displayCourseCode}</p>
                              <p>
                                <strong>90 out of 100</strong>
                              </p>
                              <p className="ic-feedback-snippet">
                                Task1: excellent · Task2: shading discussion could be deeper · Task3: excellent…
                              </p>
                            </div>
                          </Link>
                        </li>
                      </ul>
                    </div>

                    <p className="ic-demo-disclaimer">
                      Demonstration shell — not affiliated with Instructure. Brand colours mirror ANU Canvas theme.
                    </p>
                  </div>
                )}
              </aside>
            </div>
          </div>
        </div>

        {(isDashboard || isGlobalShell) && (
          <footer role="contentinfo" id="footer" className="ic-app-footer">
            <a href="http://www.instructure.com" className="footer-logo ic-app-footer__logo-link" target="_blank" rel="noreferrer">
              <span className="screenreader-only">By Instructure</span>
            </a>
            <div id="footer-links" className="ic-app-footer__links">
              <a href="https://canvas.anu.edu.au/privacy_policy">Privacy Policy</a>
              <a href="https://www.instructure.com/policies/canvas-lms-cookie-notice">Cookie Notice</a>
              <a href="http://facebook.com/instructure">Facebook</a>
              <a href="http://twitter.com/instructure">X.com</a>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}
