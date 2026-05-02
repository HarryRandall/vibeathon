import { courseHref, FEATURE_COURSE_ID } from './canvas-demo';
import { getCourseMeta, getModulesForCourse } from './dummy-data';

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

type HomeLink = {
  text: string;
  href?: string;
  external?: boolean;
};

type HomeTable = {
  caption?: string;
  columns: string[];
  rows: string[][];
};

type HomeSection = {
  title: string;
  paragraphs?: string[];
  listItems?: HomeLink[];
  secondaryListLabel?: string;
  secondaryListItems?: HomeLink[];
  table?: HomeTable;
};

export type CourseHomeData = {
  heroImage: string | null;
  sections: HomeSection[];
};

export function getCourseHomeData(courseId: string): CourseHomeData | null {
  const meta = getCourseMeta(courseId);
  if (!meta) return null;

  if (courseId !== FEATURE_COURSE_ID) {
    return {
      heroImage: meta.image,
      sections: [
        {
          title: 'Course overview',
          paragraphs: [
            `${meta.courseCode} · ${meta.subtitle}`,
            'This course uses the same Canvas shell and data-driven rendering as the other demo pages while keeping the familiar wiki-style home layout.',
          ],
        },
        {
          title: 'Quick links',
          listItems: [
            { text: 'Modules', href: courseHref(courseId, 'modules') },
            { text: 'Announcements', href: courseHref(courseId, 'announcements') },
            { text: 'Discussions', href: courseHref(courseId, 'discussions') },
            { text: 'Assignments', href: courseHref(courseId, 'assignments') },
            { text: 'Marks', href: courseHref(courseId, 'grades') },
            { text: 'People', href: courseHref(courseId, 'people') },
            { text: 'Study Assistant', href: courseHref(courseId, 'assistant') },
          ],
        },
        {
          title: 'Modules snapshot',
          table: {
            columns: ['Module', 'Items', 'Status'],
            rows: getModulesForCourse(courseId).map((module) => [module.name, String(module.items), module.state]),
          },
        },
      ],
    };
  }

  return {
    heroImage: null,
    sections: [
      {
        title: 'How to engage with this course',
        listItems: [
          { text: 'Read your Class summary and the Course contacts', href: courseHref(courseId, 'people') },
          { text: 'Get familiar with the information in the Course information module', href: courseHref(courseId, 'modules') },
          { text: 'Check Announcements and Discussions regularly' },
          { text: 'Engage with course content for each week or topic in the Modules', href: courseHref(courseId, 'modules') },
          { text: 'Check your Assessments regularly', href: courseHref(courseId, 'assignments') },
        ],
      },
      {
        title: 'Course schedule and Class summary',
        paragraphs: [
          'Your official Class Summary provides you with key information about your course including the teaching schedule and assessment requirements. It is essential that you are familiar with the information in your Class summary listed below.',
        ],
      },
      {
        title: 'Class venues',
        paragraphs: ['Attend all of:'],
        listItems: [
          { text: 'Lecture 1 - Tuesday, 9am to 10:30am, Dunbar Lecture Theatre - Physics Bldg' },
          { text: 'Lecture 2 - Wednesday, 12:30pm to 2pm, Theatre 2 - Lowitja O Donoghue Cultural Centre Bldg' },
        ],
        secondaryListLabel: 'Attend one of:',
        secondaryListItems: [
          { text: 'Lab 1 - Thursday, 10am to 11am, N113 - Building 108' },
          { text: 'Lab 2 - Thursday, 11am to 12pm, N112 - Building 108' },
          { text: 'Lab 3 - Friday, 9am to 10am, N112 - Building 108' },
          { text: 'Lab 4 - Friday, 12pm to 1pm, N113 - Building 108' },
        ],
      },
      {
        title: 'Course schedule',
        table: {
          caption: 'Course Schedule',
          columns: ['Week', 'Lecture', 'Activities & Computer Labs', 'Assessment'],
          rows: [
            ['1', 'Course overview, math review, spatial transformation', '', ''],
            ['2', 'Rasterisation I', 'C-Lab-1 workshop; C-Lab-1 session A', ''],
            ['3', 'Rasterisation II', 'C-Lab-1 session B', ''],
            ['4', 'Rasterisation III', 'C-Lab-2 workshop; C-Lab-2 session A', 'C-Lab-1 report due'],
          ],
        },
      },
      {
        title: 'Academic integrity',
        listItems: [
          {
            text: 'Click here to read about the academic integrity best practice',
            href: 'https://www.anu.edu.au/students/academic-skills/referencing-and-academic-integrity/academic-integrity-best-practice',
            external: true,
          },
        ],
      },
      {
        title: 'Content warning',
        paragraphs: [
          'At times during this course, we will engage with material involving cybercrime. You may find this challenging to engage with. We will do our best to make this course a space where we can engage respectfully and thoughtfully with difficult content.',
          'ANU provides Health, Safety and Wellbeing services free of charge to students.',
        ],
      },
    ],
  };
}

export type CanvasModuleItem = {
  id: string;
  title: string;
  type: 'wiki_page' | 'discussion_topic' | 'assignment' | 'attachment' | 'quiz';
  typeLabel: string;
  iconClass: string;
  href: string;
  meta?: string;
  points?: string;
};

export type CanvasModule = {
  id: string;
  name: string;
  state: 'complete' | 'current' | 'locked';
  items: CanvasModuleItem[];
};

function makeItem(courseId: string, id: string, title: string, type: CanvasModuleItem['type'], meta?: string, points?: string): CanvasModuleItem {
  const iconClassMap: Record<CanvasModuleItem['type'], string> = {
    wiki_page: 'icon-document',
    discussion_topic: 'icon-discussion',
    assignment: 'icon-assignment',
    attachment: 'icon-paperclip',
    quiz: 'icon-quiz',
  };

  const labelMap: Record<CanvasModuleItem['type'], string> = {
    wiki_page: 'Page',
    discussion_topic: 'Discussion Topic',
    assignment: 'Assignment',
    attachment: 'Attachment',
    quiz: 'Quiz',
  };

  return {
    id,
    title,
    type,
    typeLabel: labelMap[type],
    iconClass: iconClassMap[type],
    href: type === 'attachment' ? courseHref(courseId, 'materials') : type === 'discussion_topic' ? courseHref(courseId, 'discussions') : courseHref(courseId, type === 'assignment' ? 'assignments' : type === 'quiz' ? 'quizzes' : ''),
    meta,
    points,
  };
}

export function getCanvasModulesForCourse(courseId: string): CanvasModule[] {
  if (courseId !== FEATURE_COURSE_ID) {
    return getModulesForCourse(courseId).map((module, index) => ({
      id: `${courseId}-module-${index}`,
      name: module.name,
      state: module.state,
      items: [
        makeItem(courseId, `${courseId}-item-${index}-1`, `${module.name} overview`, 'wiki_page'),
        makeItem(courseId, `${courseId}-item-${index}-2`, `${module.name} discussion`, 'discussion_topic'),
      ],
    }));
  }

  return [
    {
      id: '63209',
      name: 'Course information',
      state: 'complete',
      items: [
        makeItem(courseId, '354640', 'Home', 'wiki_page'),
        makeItem(courseId, '354641', 'Welcome', 'wiki_page'),
        makeItem(courseId, '354642', 'Class summary', 'wiki_page'),
        makeItem(courseId, '354643', 'Course contacts', 'wiki_page'),
        makeItem(courseId, '354646', 'Course Q&A', 'discussion_topic'),
      ],
    },
    {
      id: '63210',
      name: 'Assessments',
      state: 'current',
      items: [
        makeItem(courseId, '354647', 'Course assessment information', 'wiki_page'),
        makeItem(courseId, '354648', 'Assessment extensions and Extenuating circumstances application (ECA)', 'wiki_page'),
        makeItem(courseId, '475480', 'Midsem Test', 'wiki_page', '', '15'),
      ],
    },
    {
      id: '85891',
      name: 'Assignment 1',
      state: 'current',
      items: [
        makeItem(courseId, '483834', 'Assignment Information', 'wiki_page'),
        makeItem(courseId, '483839', 'Assignment 1 - Report', 'assignment', '', '13.5'),
        makeItem(courseId, '483847', 'Assignment 1 - Artefact', 'quiz', '', '1.5'),
        makeItem(courseId, '483849', 'assessment-guidelines.pdf', 'attachment'),
      ],
    },
    {
      id: '63211',
      name: 'Week 1: Introduction',
      state: 'complete',
      items: [makeItem(courseId, '354649', 'Week 1: Introduction', 'wiki_page')],
    },
    {
      id: '80967',
      name: 'Week 2: Identification and Authentication and Access Control',
      state: 'complete',
      items: [makeItem(courseId, '442124', 'Week 2: Identification and Authentication and Access Control', 'wiki_page')],
    },
    {
      id: '84444',
      name: 'Week 3: Reference Monitor and Usenix Security',
      state: 'current',
      items: [makeItem(courseId, '466528', 'Week 3: Reference Monitor and Usenix Security', 'wiki_page')],
    },
    {
      id: '85207',
      name: 'Week 4: Software Security',
      state: 'current',
      items: [makeItem(courseId, '474357', 'Week 4: Software Security', 'wiki_page')],
    },
    {
      id: '85413',
      name: 'Week 5: Introduction To Cryptography',
      state: 'locked',
      items: [makeItem(courseId, '476889', 'Week 5: Introduction to Cryptography', 'wiki_page')],
    },
  ];
}
