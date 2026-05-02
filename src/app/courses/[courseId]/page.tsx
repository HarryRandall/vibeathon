import Link from 'next/link';
import { courseHref, DASHBOARD_COURSES, FEATURE_COURSE_ID } from '@/lib/canvas-demo';

/** Full wiki-style home for the demo feature course; other IDs get a short stub. */
export default function CourseHomePage({ params }: { params: { courseId: string } }) {
  const courseId = params.courseId;
  const meta = DASHBOARD_COURSES.find((c) => c.id === courseId);

  if (courseId !== FEATURE_COURSE_ID) {
    return (
      <div className="user_content">
        <h2>{meta?.shortName ?? 'Course'}</h2>
        <p className="text-sm leading-relaxed text-neutral-700">
          This prototype wires the full course shell and study tools for{' '}
          <strong>Computer Graphics ({FEATURE_COURSE_ID})</strong> only.
        </p>
        <p className="mt-4 text-sm">
          <Link href={`/courses/${FEATURE_COURSE_ID}`} className="text-[#146ebd] underline">
            Open Computer Graphics
          </Link>{' '}
          ·{' '}
          <Link href="/" className="text-[#146ebd] underline">
            Back to Dashboard
          </Link>
        </p>
      </div>
    );
  }

  const ass = courseHref(courseId, 'assistant');
  const mat = courseHref(courseId, 'materials');
  const qui = courseHref(courseId, 'quizzes');

  return (
    <div className="user_content">
      <div className="mb-6 rounded border border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-600">
        Banner image placeholder (course hero loads here in Canvas).
      </div>

      <h2>How to engage with this course</h2>
      <ul style={{ listStyleType: 'disc' }}>
        <li>
          Read your <Link href="#">Class summary</Link> and the <Link href="#">Course contacts</Link>
        </li>
        <li>
          Read <Link href="#">Course Outline</Link>.
        </li>
        <li>
          Get familiar with the information in the <Link href="#">Course information</Link> module
        </li>
        <li>Check Announcements and Discussions regularly</li>
        <li>
          Engage with course content for each week or topic in the <Link href="#">Modules</Link>
        </li>
        <li>
          Check your <Link href="#">Assessments</Link> regularly
        </li>
      </ul>

      <h2>Class summary</h2>
      <ul>
        <li>
          <Link href="https://programsandcourses.anu.edu.au/course/COMP4610" target="_blank" rel="noreferrer">
            COMP4610
          </Link>
        </li>
        <li>
          <Link href="https://programsandcourses.anu.edu.au/course/COMP8610" target="_blank" rel="noreferrer">
            COMP8610
          </Link>
        </li>
      </ul>

      <h2>Course schedule</h2>
      <p style={{ fontSize: '12pt', color: '#000000', lineHeight: '25px' }}>
        The following table gives you information and links to what you will be doing each week. Please note: The
        content of each module might not be available until just before it is due to begin.
      </p>

      <table style={{ borderCollapse: 'collapse', width: '98%', borderColor: '#be830e' }} border={3}>
        <caption>Course Schedule</caption>
        <thead>
          <tr style={{ textAlign: 'center', height: '28px' }}>
            <th style={{ width: '15%', height: '28px' }} scope="col">
              <strong>Week</strong>
            </th>
            <th style={{ width: '30%', height: '28px' }} scope="col">
              <strong>Lecture</strong>
            </th>
            <th style={{ width: '26%', height: '28px' }} scope="col">
              <strong>Activities &amp; Computer Labs</strong>
            </th>
            <th style={{ width: '29%', height: '28px' }} scope="col">
              <strong>Assessment</strong>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ height: '29px' }}>
            <td style={{ width: '15%', textAlign: 'center', height: '29px' }}>
              <strong>1</strong>
            </td>
            <td>Course overview, math review, spatial transformation</td>
            <td />
            <td />
          </tr>
          <tr style={{ height: '29px' }}>
            <td style={{ textAlign: 'center', height: '29px' }}>
              <strong>2</strong>
            </td>
            <td>Rasterisation I</td>
            <td>C-Lab-1 workshop; C-Lab-1 session A</td>
            <td />
          </tr>
          <tr style={{ height: '29px' }}>
            <td style={{ textAlign: 'center', height: '29px' }}>
              <strong>3</strong>
            </td>
            <td>Rasterisation II</td>
            <td>C-Lab-1 session B</td>
            <td />
          </tr>
          <tr style={{ height: '29px' }}>
            <td style={{ textAlign: 'center', height: '29px' }}>
              <strong>4</strong>
            </td>
            <td>Rasterisation III</td>
            <td>C-Lab-2 workshop; C-Lab-2 session A</td>
            <td>C-Lab-1 report due</td>
          </tr>
        </tbody>
      </table>

      <h2>Smart study assistant</h2>
      <p>
        Open the integrated tool from the course menu: <Link href={ass}>Study Assistant</Link> — summaries, Q&amp;A,{' '}
        <Link href={mat}>readings index</Link>, and <Link href={qui}>practice quizzes</Link> when your materials are
        synced.
      </p>

      <h2>Academic integrity</h2>
      <p style={{ textDecoration: 'underline', fontSize: '12pt' }}>
        <Link
          href="https://www.anu.edu.au/students/academic-skills/referencing-and-academic-integrity/academic-integrity-best-practice"
          target="_blank"
          rel="noreferrer"
        >
          Click here to read about academic integrity best practice
        </Link>
      </p>

      <p>
        ANU provides{' '}
        <Link href="https://www.anu.edu.au/students/health-safety-wellbeing" target="_blank" rel="noreferrer">
          Health, Safety and Wellbeing services
        </Link>{' '}
        free of charge to students.
      </p>
    </div>
  );
}
