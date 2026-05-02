'use client';

import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';
import type { DashboardCourseCard } from '@/lib/canvas-demo';

type DashboardCoursesContextValue = {
  courses: DashboardCourseCard[];
  featuredCourseId: string | null;
};

const DashboardCoursesContext = createContext<DashboardCoursesContextValue>({
  courses: [],
  featuredCourseId: null,
});

export function DashboardCoursesProvider({
  courses,
  featuredCourseId,
  children,
}: {
  courses: DashboardCourseCard[];
  featuredCourseId: string | null;
  children: ReactNode;
}) {
  return (
    <DashboardCoursesContext.Provider value={{ courses, featuredCourseId }}>{children}</DashboardCoursesContext.Provider>
  );
}

export function useDashboardCourses() {
  return useContext(DashboardCoursesContext);
}
