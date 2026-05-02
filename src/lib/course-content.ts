import { courseHref, FEATURE_COURSE_ID } from './canvas-demo';
import {
  getAnnouncementsForCourse,
  getAssignmentsForCourse,
  getDiscussionsForCourse,
  getGradesForCourse,
  getModulesForCourse,
  getPeopleForCourse,
  getCourseMeta,
} from './dummy-data';

export const COURSE_NAV_ITEMS = [
  { key: 'home', label: 'Home', segments: [] as string[] },
  { key: 'modules', label: 'Modules', segments: ['modules'] },
  { key: 'announcements', label: 'Announcements', segments: ['announcements'] },
  { key: 'discussions', label: 'Discussions', segments: ['discussions'] },
  { key: 'assistant', label: 'Study Assistant', segments: ['assistant'] },
  { key: 'recordings', label: 'Class Recordings', segments: ['recordings'] },
  { key: 'materials', label: 'Readings', segments: ['materials'] },
  { key: 'assignments', label: 'Assignments', segments: ['assignments'] },
  { key: 'grades', label: 'Marks', segments: ['grades'] },
  { key: 'people', label: 'People', segments: ['people'] },
  { key: 'quizzes', label: 'Practice quizzes', segments: ['quizzes'] },
  { key: 'ed-discussion', label: 'Ed Discussion', segments: ['ed-discussion'] },
] as const;

export const COURSE_CONTENT_SECTIONS = ['modules', 'announcements', 'discussions', 'recordings', 'assignments', 'grades', 'people', 'ed-discussion'] as const;
export type CourseContentSection = (typeof COURSE_CONTENT_SECTIONS)[number];

export function buildCourseSectionTabs(courseId: string) {
  return COURSE_NAV_ITEMS.map((item) => ({
    label: item.label,
    href: courseHref(courseId, ...item.segments),
  }));
}

type HeroMetric = {
  label: string;
  value: string;
};

type ActionItem = {
  label: string;
  href: string;
  description: string;
  external?: boolean;
};

type ChecklistBlock = {
  type: 'checklist';
  title: string;
  description?: string;
  items: Array<{ text: string; href?: string; external?: boolean }>;
};

type LinkGridBlock = {
  type: 'link-grid';
  title: string;
  description?: string;
  items: ActionItem[];
};

type TableBlock = {
  type: 'table';
  title: string;
  description?: string;
  caption?: string;
  columns: string[];
  rows: string[][];
};

type NoticeBlock = {
  type: 'notice';
  title: string;
  body: string;
  tone?: 'neutral' | 'accent';
  links?: ActionItem[];
};

export type CourseHomeBlock = ChecklistBlock | LinkGridBlock | TableBlock | NoticeBlock;

export type CourseHomePageData = {
  eyebrow: string;
  title: string;
  summary: string;
  badges: string[];
  metrics: HeroMetric[];
  blocks: CourseHomeBlock[];
};

type DataTableColumn = {
  key: string;
  label: string;
};

type DataTableSection = {
  type: 'table';
  title: string;
  intro: string;
  columns: DataTableColumn[];
  rows: Array<Record<string, string>>;
  footer?: string;
};

type FeedSection = {
  type: 'feed';
  title: string;
  intro: string;
  items: Array<{
    id: string;
    title: string;
    meta?: string;
    body?: string;
    badge?: string;
  }>;
};

type PanelSection = {
  type: 'panel';
  title: string;
  intro: string;
  body: string;
  bullets?: string[];
  action?: ActionItem;
};

export type CourseSectionPageData = DataTableSection | FeedSection | PanelSection;

export function getCourseHomePageData(courseId: string): CourseHomePageData | null {
  const meta = getCourseMeta(courseId);
  if (!meta) return null;

  if (courseId !== FEATURE_COURSE_ID) {
    const modules = getModulesForCourse(courseId);
    const assignments = getAssignmentsForCourse(courseId);
    const quickLinks: ActionItem[] = [
      { label: 'Browse modules', href: courseHref(courseId, 'modules'), description: 'Weekly material, lecture notes, and lab sequences.' },
      { label: 'Check announcements', href: courseHref(courseId, 'announcements'), description: 'Convenor updates and schedule changes.' },
      { label: 'Open assignments', href: courseHref(courseId, 'assignments'), description: 'Assessment details, due dates, and submissions.' },
      { label: 'Study Assistant', href: courseHref(courseId, 'assistant'), description: 'Summaries, Q&A, and practice support.' },
    ];

    return {
      eyebrow: meta.term,
      title: meta.shortName,
      summary: `${meta.courseCode} · ${meta.subtitle}. This view turns the standard course homepage into a clearer launchpad for the material you use most.`,
      badges: ['Canvas shell', 'Student view', 'Dynamic demo content'],
      metrics: [
        { label: 'Current modules', value: String(modules.length) },
        { label: 'Upcoming assessments', value: String(assignments.length) },
        { label: 'Term', value: 'S1 2026' },
      ],
      blocks: [
        {
          type: 'link-grid',
          title: 'Start here',
          description: 'The quickest ways into the course areas students usually need first.',
          items: quickLinks,
        },
        {
          type: 'table',
          title: 'Module snapshot',
          description: 'A compact overview of the current learning sequence.',
          columns: ['Module', 'Items', 'Status'],
          rows: modules.map((module) => [module.name, String(module.items), module.state]),
        },
        {
          type: 'notice',
          title: 'Need the full assistant workflow?',
          body: 'The Computer Graphics course remains the fully expanded reference implementation for synced readings, quizzes, and the richer course-home layout.',
          tone: 'accent',
          links: [
            {
              label: 'Open the reference course',
              href: courseHref(FEATURE_COURSE_ID),
              description: 'See the most complete example in the demo app.',
            },
          ],
        },
      ],
    };
  }

  return {
    eyebrow: 'First Semester, 2026',
    title: 'Computer Graphics',
    summary:
      'A modern course launchpad built from the Canvas examples in Downloads. It keeps the core ANU Canvas structure, then surfaces course expectations, schedule, and study tools in reusable panels instead of raw page markup.',
    badges: ['Featured course', 'Canvas-inspired', 'Study workflow ready'],
    metrics: [
      { label: 'Course codes', value: '2 streams' },
      { label: 'Core blocks', value: '4' },
      { label: 'Assistant', value: 'Ready' },
    ],
    blocks: [
      {
        type: 'checklist',
        title: 'How to engage with this course',
        description: 'The essential first-run flow for a student entering the subject.',
        items: [
          { text: 'Read the class summary and course contacts', href: courseHref(courseId, 'people') },
          { text: 'Read the course outline and introductory module', href: courseHref(courseId, 'modules') },
          { text: 'Check announcements and discussions every week', href: courseHref(courseId, 'announcements') },
          { text: 'Use modules to move through weekly content and labs', href: courseHref(courseId, 'modules') },
          { text: 'Track assessment requirements in Assignments and Marks', href: courseHref(courseId, 'assignments') },
        ],
      },
      {
        type: 'link-grid',
        title: 'Class summary',
        description: 'Official ANU course handbook entries for both streams.',
        items: [
          {
            label: 'COMP4610',
            href: 'https://programsandcourses.anu.edu.au/course/COMP4610',
            description: 'Undergraduate stream course handbook entry.',
            external: true,
          },
          {
            label: 'COMP8610',
            href: 'https://programsandcourses.anu.edu.au/course/COMP8610',
            description: 'Postgraduate stream course handbook entry.',
            external: true,
          },
          {
            label: 'Study Assistant',
            href: courseHref(courseId, 'assistant'),
            description: 'Summaries, Q&A, and revision support inside the course shell.',
          },
          {
            label: 'Readings index',
            href: courseHref(courseId, 'materials'),
            description: 'A structured view of synced readings and source material.',
          },
        ],
      },
      {
        type: 'table',
        title: 'Course schedule',
        description: 'A weekly view derived from the existing home page and cleaned up into a reusable schedule component.',
        caption: 'Course schedule',
        columns: ['Week', 'Lecture', 'Activities & labs', 'Assessment'],
        rows: [
          ['1', 'Course overview, math review, spatial transformation', 'Orientation and setup', ''],
          ['2', 'Rasterisation I', 'C-Lab-1 workshop · Session A', ''],
          ['3', 'Rasterisation II', 'C-Lab-1 session B', ''],
          ['4', 'Rasterisation III', 'C-Lab-2 workshop · Session A', 'C-Lab-1 report due'],
        ],
      },
      {
        type: 'notice',
        title: 'Academic integrity and student support',
        body: 'Course tools should help you study faster, not bypass the work. Follow ANU academic integrity guidance and use wellbeing services early if workload or personal circumstances start affecting progress.',
        links: [
          {
            label: 'Academic integrity guidance',
            href: 'https://www.anu.edu.au/students/academic-skills/referencing-and-academic-integrity/academic-integrity-best-practice',
            description: 'ANU best-practice guidance.',
            external: true,
          },
          {
            label: 'Health, Safety and Wellbeing',
            href: 'https://www.anu.edu.au/students/health-safety-wellbeing',
            description: 'Student support services.',
            external: true,
          },
        ],
      },
    ],
  };
}

export function getCourseSectionPageData(courseId: string, section: CourseContentSection): CourseSectionPageData {
  switch (section) {
    case 'modules':
      return {
        type: 'table',
        title: 'Modules',
        intro: 'Progress through the course in sequence. Each module groups readings, labs, and weekly tasks.',
        columns: [
          { key: 'name', label: 'Module' },
          { key: 'items', label: 'Items' },
          { key: 'state', label: 'Status' },
        ],
        rows: getModulesForCourse(courseId).map((row) => ({
          name: row.name,
          items: String(row.items),
          state: row.state,
        })),
      };
    case 'announcements':
      return {
        type: 'feed',
        title: 'Announcements',
        intro: 'Updates from the teaching team, grouped into reusable announcement cards.',
        items: getAnnouncementsForCourse(courseId).map((item) => ({
          id: item.id,
          title: item.title,
          meta: item.date,
          body: item.body,
          badge: 'Announcement',
        })),
      };
    case 'discussions':
      return {
        type: 'feed',
        title: 'Discussions',
        intro: 'Community questions and course threads, rendered as a structured activity list.',
        items: getDiscussionsForCourse(courseId).map((item) => ({
          id: item.id,
          title: item.topic,
          meta: `${item.replies} replies`,
          body: `Last activity ${item.last}`,
          badge: 'Thread',
        })),
      };
    case 'recordings':
      return {
        type: 'panel',
        title: 'Class Recordings',
        intro: 'Canvas would usually embed EchoVideo or a similar media tool here.',
        body: 'This demo keeps recordings as structured content so the layout stays clean even before real media integration is wired in.',
        bullets: ['Week 5 — Rasterisation (52 min)', 'Week 6 — Animation overview (48 min)', 'Lab walkthrough — C-Lab-3 (35 min)'],
      };
    case 'assignments':
      return {
        type: 'table',
        title: 'Assignments',
        intro: 'Assessment items are rendered from course data rather than hand-authored table markup.',
        columns: [
          { key: 'name', label: 'Assignment' },
          { key: 'due', label: 'Due' },
          { key: 'pts', label: 'Pts' },
          { key: 'status', label: 'Status' },
        ],
        rows: getAssignmentsForCourse(courseId).map((row) => ({
          name: row.name,
          due: row.due,
          pts: String(row.pts),
          status: row.status,
        })),
      };
    case 'grades':
      return {
        type: 'table',
        title: 'Marks',
        intro: 'A calmer, data-driven marks table with room for policy or release notes.',
        columns: [
          { key: 'assignment', label: 'Assignment' },
          { key: 'score', label: 'Score' },
          { key: 'when', label: 'Submitted / status' },
        ],
        rows: getGradesForCourse(courseId).map((row) => ({
          assignment: row.assignment,
          score: row.score,
          when: row.when,
        })),
        footer: 'Final grades follow ANU policy; provisional marks remain subject to release by the convenor.',
      };
    case 'people':
      return {
        type: 'table',
        title: 'People',
        intro: 'Teaching staff and classmates in a reusable roster layout.',
        columns: [
          { key: 'role', label: 'Role' },
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email' },
        ],
        rows: getPeopleForCourse(courseId).map((row) => ({
          role: row.role,
          name: row.name,
          email: row.email,
        })),
      };
    case 'ed-discussion':
      return {
        type: 'panel',
        title: 'Ed Discussion',
        intro: 'Production would usually open Ed in an LTI frame.',
        body: 'For this demo, the course shell uses the same structured panel system to explain where that integration would sit and how students should continue technical conversations in the meantime.',
        action: {
          label: 'Open Canvas Discussions',
          href: courseHref(courseId, 'discussions'),
          description: 'Use the internal discussion area in this demo.',
        },
      };
  }
}
