import type { Metadata } from 'next';
import CanvasShell from '@/components/canvas-shell';
import { DashboardCoursesProvider } from '@/context/dashboard-courses-context';
import { loadSyncedDashboardCourses } from '@/lib/dashboard-courses-server';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Dashboard', template: '%s · Canvas demo' },
  description: 'Dashboard and course workspace — smart study assistant demo.',
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { courses, featuredCourseId } = await loadSyncedDashboardCourses();

  return (
    <html lang="en-AU">
      <body className="min-h-screen antialiased">
        <DashboardCoursesProvider courses={courses} featuredCourseId={featuredCourseId}>
          <CanvasShell>{children}</CanvasShell>
        </DashboardCoursesProvider>
      </body>
    </html>
  );
}
