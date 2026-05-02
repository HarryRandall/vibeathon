import type { DashboardCourseCard } from './canvas-demo';
import { DASHBOARD_COURSES } from './canvas-demo';

/** Single dummy student — realistic ANU-style demo account. */
export const DEMO_USER = {
  displayName: 'Alex Morgan',
  sortableName: 'Morgan, Alex',
  email: 'u1234567@anu.edu.au',
  pronouns: 'they/them',
  timezone: 'Australia/Canberra',
  avatarUrl: 'https://canvas.anu.edu.au/images/messages/avatar-50.png',
} as const;

export type TodoItem = {
  id: string;
  courseCode: string;
  title: string;
  dueLabel: string;
  points: number;
  href: string;
};

/** Dashboard + course sidebar To Do (cross-course). */
export const DEMO_TODOS: TodoItem[] = [
  {
    id: '1',
    courseCode: 'COMP4610/COMP8610',
    title: 'Project-2 report draft',
    dueLabel: 'May 18, 11:59 pm',
    points: 40,
    href: '/courses/7624/assignments',
  },
  {
    id: '2',
    courseCode: 'COMP4528/COMP6528',
    title: 'Quiz 3 — Convolution & CNNs',
    dueLabel: 'May 14, 5:00 pm',
    points: 5,
    href: '/courses/7640/assignments',
  },
  {
    id: '3',
    courseCode: 'COMP3242/COMP6242',
    title: 'Lab notebook checkpoint',
    dueLabel: 'May 9, 10:00 pm',
    points: 10,
    href: '/courses/8594/assignments',
  },
  {
    id: '4',
    courseCode: 'COMP4130',
    title: 'Reading reflection — Week 9',
    dueLabel: 'May 11, 11:59 pm',
    points: 2,
    href: '/courses/5783/assignments',
  },
];

export type GroupRow = { id: string; name: string; courseLabel: string; href: string };

export const DEMO_GROUPS: GroupRow[] = [
  { id: '1526', name: 'Presentation Group 11', courseLabel: 'COMP4130', href: '/groups/1526' },
  { id: '9489', name: 'GROUP selection 2: APAC Partners', courseLabel: 'COMP4528', href: '/groups/9489' },
  { id: '16789', name: 'Projects 15', courseLabel: 'COMP4528', href: '/groups/16789' },
  { id: '18943', name: 'Team “Gundam”', courseLabel: 'COMP4610', href: '/groups/18943' },
];

export type InboxThread = {
  id: string;
  course: string;
  subject: string;
  preview: string;
  timeLabel: string;
  unread: boolean;
};

export const DEMO_INBOX: InboxThread[] = [
  {
    id: 't1',
    course: 'Computer Graphics',
    subject: 'Re: C-Lab-3 clarification',
    preview: 'Hi Alex — yes, you may use the framework code from the workshop…',
    timeLabel: '2 hours ago',
    unread: true,
  },
  {
    id: 't2',
    course: 'Deep Learning',
    subject: 'Assignment extension policy',
    preview: 'Extensions require medical certificate or ANU appointment letter…',
    timeLabel: 'Yesterday',
    unread: false,
  },
  {
    id: 't3',
    course: 'Computer Vision',
    subject: 'Tutorial room change — Week 10',
    preview: 'Please note Tuesday tutorial moves to CSIT N101…',
    timeLabel: '3 days ago',
    unread: false,
  },
];

export type CalendarEvent = {
  id: string;
  dayLabel: string;
  time: string;
  title: string;
  course: string;
};

export const DEMO_CALENDAR_EVENTS: CalendarEvent[] = [
  { id: 'e1', dayLabel: 'Mon 5 May', time: '10:00', title: 'Graphics lecture', course: 'COMP4610' },
  { id: 'e2', dayLabel: 'Tue 6 May', time: '14:00', title: 'Vision lab', course: 'COMP4528' },
  { id: 'e3', dayLabel: 'Wed 7 May', time: '09:00', title: 'Deep Learning workshop', course: 'COMP3242' },
  { id: 'e4', dayLabel: 'Thu 8 May', time: '16:00', title: 'MSQP tutorial', course: 'COMP4130' },
];

export type HistoryRow = { id: string; label: string; href: string; when: string };

export const DEMO_HISTORY: HistoryRow[] = [
  { id: 'h1', label: 'Computer Graphics — Home', href: '/courses/7624', when: 'Today, 8:14 am' },
  { id: 'h2', label: 'Practice quiz', href: '/courses/7624/assistant?tab=quiz', when: 'Today, 8:02 am' },
  { id: 'h3', label: 'Dashboard', href: '/', when: 'Yesterday, 6:40 pm' },
  { id: 'h4', label: 'Deep Learning — Modules', href: '/courses/8594/modules', when: 'Yesterday, 4:15 pm' },
];

export function getCourseMeta(courseId: string): DashboardCourseCard | undefined {
  return DASHBOARD_COURSES.find((c) => c.id === courseId);
}

export function getAssignmentsForCourse(courseId: string) {
  const meta = getCourseMeta(courseId);
  const code = meta?.courseCode ?? courseId;
  const name = meta?.shortName ?? 'Course';
  return [
    { name: `${name} — Problem set 2`, due: 'May 16, 11:59 pm', pts: 15, status: 'available' as const },
    { name: `${name} — Mid-semester quiz`, due: 'May 22, 5:00 pm', pts: 10, status: 'available' as const },
    { name: `${name} — Project milestone`, due: 'Jun 2, 11:59 pm', pts: 25, status: 'locked' as const },
  ];
}

export function getGradesForCourse(courseId: string) {
  const meta = getCourseMeta(courseId);
  const code = meta?.courseCode ?? courseId;
  return [
    { assignment: 'Lab 1', score: '88 / 100', when: 'Apr 18' },
    { assignment: 'Quiz 1', score: '19 / 20', when: 'Apr 25' },
    { assignment: 'Problem set 1', score: '—', when: 'Pending' },
  ].map((r) => ({ ...r, courseCode: code }));
}

export function getPeopleForCourse(courseId: string) {
  return [
    { role: 'Teacher', name: 'Prof. Jordan Lee', email: 'jordan.lee@anu.edu.au' },
    { role: 'Tutor', name: 'Sam Nguyen', email: 'sam.nguyen@anu.edu.au' },
    { role: 'Student', name: 'Alex Morgan', email: DEMO_USER.email },
    { role: 'Student', name: 'Jamie Chen', email: 'u7654321@anu.edu.au' },
  ];
}

export function getAnnouncementsForCourse(courseId: string) {
  const meta = getCourseMeta(courseId);
  const title = meta?.shortName ?? 'Course';
  return [
    { id: 'a1', title: `Welcome to ${title}`, date: 'Feb 24', body: 'Please read the course outline and join the Ed forum for technical questions.' },
    { id: 'a2', title: 'Assessment schedule reminder', date: 'Apr 02', body: 'Check the Assessments module for due dates. Extensions follow ANU policy.' },
    { id: 'a3', title: 'Mid-semester consultation hours', date: 'Apr 28', body: 'Extra drop-in hours this week in CSIT building — see Modules for times.' },
  ];
}

export function getDiscussionsForCourse(courseId: string) {
  const meta = getCourseMeta(courseId);
  const title = meta?.shortName ?? 'Course';
  return [
    { topic: 'General Q&A', replies: 14, last: '2h ago' },
    { topic: 'Assignment 2 — clarifications', replies: 8, last: '1d ago' },
    { topic: 'Study groups', replies: 22, last: '3d ago' },
  ].map((d, i) => ({ ...d, id: `${courseId}-d${i}`, course: title }));
}

export function getModulesForCourse(courseId: string) {
  const meta = getCourseMeta(courseId);
  const label = meta?.shortName ?? 'Course';
  return [
    { name: 'Course information', items: 4, state: 'complete' as const },
    { name: 'Week 1–4 foundations', items: 12, state: 'complete' as const },
    { name: 'Week 5–8 core topics', items: 10, state: 'current' as const },
    { name: 'Week 9–12 assessment', items: 6, state: 'locked' as const },
  ].map((m, i) => ({ ...m, id: `${courseId}-m${i}`, courseLabel: label }));
}
