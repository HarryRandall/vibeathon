/** Demo routing — mirrors canvas.anu.edu.au-style URLs. */
export const FEATURE_COURSE_ID = '7624';

export function courseHref(courseId: string, ...segments: string[]) {
  const rest = segments.filter(Boolean).join('/');
  return rest ? `/courses/${courseId}/${rest}` : `/courses/${courseId}`;
}

export type DashboardCourseCard = {
  id: string;
  courseCode: string;
  shortName: string;
  term: string;
  subtitle: string;
  color: string | null;
  image: string | null;
};

/** Subset aligned with Canvas dashboard_cards / planner demo data. */
export const DASHBOARD_COURSES: DashboardCourseCard[] = [
  {
    id: '8878',
    courseCode: 'CBEA3001/WILC6001',
    shortName: 'CBEA Special Industry Project',
    term: 'First Semester, 2026',
    subtitle: 'enrolled as: Student',
    color: '#008400',
    image: null,
  },
  {
    id: '7624',
    courseCode: 'COMP4610/COMP8610',
    shortName: 'Computer Graphics',
    term: 'First Semester, 2026',
    subtitle: 'enrolled as: Student',
    color: '#324A4D',
    image: null,
  },
  {
    id: '7640',
    courseCode: 'COMP4528/COMP6528/ENGN4528/ENGN6528',
    shortName: 'Computer Vision',
    term: 'First Semester, 2026',
    subtitle: 'enrolled as: Student',
    color: '#177B63',
    image: null,
  },
  {
    id: '8594',
    courseCode: 'COMP3242/COMP6242',
    shortName: 'Deep Learning',
    term: 'First Semester, 2026',
    subtitle: 'enrolled as: Student',
    color: '#91349B',
    image: null,
  },
  {
    id: '5783',
    courseCode: 'COMP4130',
    shortName: 'Managing Software Quality and Process',
    term: 'First Semester, 2026',
    subtitle: 'enrolled as: Student',
    color: '#E1185C',
    image: null,
  },
];
