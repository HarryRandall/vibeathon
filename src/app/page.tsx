import { DASHBOARD_COURSES } from '@/lib/canvas-demo';
import { DEMO_TODOS } from '@/lib/dummy-data';
import { DashboardPageView } from '@/components/canvas/dashboard-page';

export default function DashboardPage() {
  return <DashboardPageView courses={DASHBOARD_COURSES} todos={DEMO_TODOS} />;
}
