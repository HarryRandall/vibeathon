'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { getCourseMeta } from '@/lib/dummy-data';
import { getCourseSectionLabel } from '@/lib/course-content';

type CanvasTopBarProps = {
  pathname: string;
  isCourseShell: boolean;
  activeCourseId: string | null;
  courseMenuOpen: boolean;
  globalNavCollapsed: boolean;
  globalTitle: string;
  onToggleCourseMenu: () => void;
  onToggleGlobalNav: () => void;
};

type Crumb = {
  href?: string;
  label: string;
  current?: boolean;
  home?: boolean;
};

function IconHamburger() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="canvas-inline-icon canvas-inline-icon--menu">
      <path d="M3 5.25h14v1.5H3zm0 4h14v1.5H3zm0 4h14v1.5H3z" fill="currentColor" />
    </svg>
  );
}

function IconHome() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="canvas-inline-icon">
      <path
        d="M10 3.1 3.2 8.7v8.2h4.6v-5h4.4v5h4.6V8.7L10 3.1Zm0-2 8.2 6.7v10.6h-7.1v-5H8.9v5H1.8V7.8L10 1.1Z"
        fill="currentColor"
      />
    </svg>
  );
}

function buildCourseCrumbs(pathname: string, activeCourseId: string | null): Crumb[] {
  const crumbs: Crumb[] = [{ href: '/', label: 'My Dashboard', home: true }];
  if (!activeCourseId) return crumbs;

  const courseMeta = getCourseMeta(activeCourseId);
  const courseCode = courseMeta?.courseCode ?? activeCourseId;
  crumbs.push({ href: `/courses/${activeCourseId}`, label: courseCode });

  const section = pathname.split('/')[3];
  if (section) {
    crumbs.push({
      href: pathname,
      label: getCourseSectionLabel(section) ?? section,
      current: true,
    });
  } else {
    crumbs[crumbs.length - 1] = { ...crumbs[crumbs.length - 1], current: true };
  }

  return crumbs;
}

function buildGlobalCrumbs(globalTitle: string): Crumb[] {
  return [
    { href: '/', label: 'My Dashboard', home: true },
    { label: globalTitle, current: true },
  ];
}

export default function CanvasTopBar({
  pathname,
  isCourseShell,
  activeCourseId,
  courseMenuOpen,
  globalNavCollapsed,
  globalTitle,
  onToggleCourseMenu,
  onToggleGlobalNav,
}: CanvasTopBarProps) {
  const crumbs = useMemo(
    () => (isCourseShell ? buildCourseCrumbs(pathname, activeCourseId) : buildGlobalCrumbs(globalTitle)),
    [activeCourseId, globalTitle, isCourseShell, pathname],
  );

  const rightLabel = isCourseShell ? 'Course area' : 'Workspace';
  const rightValue = isCourseShell ? getCourseSectionLabel(pathname.split('/')[3] ?? '') ?? 'Home' : globalTitle;
  const navToggleLabel = isCourseShell
    ? courseMenuOpen
      ? 'Hide Courses Navigation Menu'
      : 'Show Courses Navigation Menu'
    : globalNavCollapsed
      ? 'Expand global navigation'
      : 'Minimise global navigation';
  const handleNavToggle = isCourseShell ? onToggleCourseMenu : onToggleGlobalNav;

  return (
    <div className="ic-app-nav-toggle-and-crumbs no-print">
      <button
        type="button"
        id="courseMenuToggle"
        className="Button Button--link ic-app-course-nav-toggle"
        aria-live="polite"
        aria-label={navToggleLabel}
        title={navToggleLabel}
        onClick={handleNavToggle}
      >
        <IconHamburger />
      </button>

      <div className="ic-app-crumbs ic-app-crumbs-enhanced-rubrics">
        <nav id="breadcrumbs" role="navigation" aria-label="breadcrumbs">
          <ol>
            {crumbs.map((crumb) => (
              <li key={`${crumb.label}-${crumb.href ?? 'current'}`} className={crumb.home ? 'home' : undefined} aria-current={crumb.current ? 'page' : undefined}>
                {crumb.href ? (
                  <Link href={crumb.href}>
                    <span className="ellipsible">
                      {crumb.home ? (
                        <>
                          <IconHome />
                          <span className="screenreader-only">{crumb.label}</span>
                        </>
                      ) : (
                        crumb.label
                      )}
                    </span>
                  </Link>
                ) : (
                  <span className="ellipsible">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      </div>

      <div id="nutrition_facts_container" />
      <div className="right-of-crumbs right-of-crumbs-no-reverse">
        <div className="canvas-topbar-meta">
          <span className="canvas-topbar-meta__label">{rightLabel}</span>
          <span className="canvas-topbar-meta__value">{rightValue}</span>
        </div>
      </div>
    </div>
  );
}
