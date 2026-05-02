import Link from 'next/link';
import { courseHref, DASHBOARD_COURSES, FEATURE_COURSE_ID } from '@/lib/canvas-demo';
import { getCourseMeta, getModulesForCourse } from '@/lib/dummy-data';

/** Full wiki-style home for the demo feature course; other dashboard courses get a rich dummy home. */
export default function CourseHomePage({ params }: { params: { courseId: string } }) {
  const courseId = params.courseId;
  const meta = getCourseMeta(courseId);

  if (courseId !== FEATURE_COURSE_ID && meta) {
    const modules = getModulesForCourse(courseId);
    const mod = courseHref(courseId, 'modules');
    const assist = courseHref(courseId, 'assistant');

    return (
      <div className="user_content">
        <div className="mb-6 rounded border border-neutral-200 bg-white px-4 py-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{meta.term}</p>
          <h1 className="ic-page-h1 mt-1">{meta.shortName}</h1>
          <p className="mt-2 text-sm text-neutral-600">
            {meta.courseCode} · {meta.subtitle}
          </p>
        </div>

        <h2>Course overview</h2>
        <p className="text-sm leading-relaxed text-neutral-700">
          Full Study Assistant wiring is showcased in{' '}
          <Link href={`/courses/${FEATURE_COURSE_ID}`} className="text-[#146ebd] underline">
            Computer Graphics
          </Link>
          . This course uses the same shell with demo modules, announcements, and grades populated from sample data.
        </p>

        <h2>Quick links</h2>
        <ul style={{ listStyleType: 'disc' }}>
          <li>
            <Link href={mod}>Modules</Link>
          </li>
          <li>
            <Link href={courseHref(courseId, 'announcements')}>Announcements</Link>
          </li>
          <li>
            <Link href={courseHref(courseId, 'discussions')}>Discussions</Link>
          </li>
          <li>
            <Link href={courseHref(courseId, 'assignments')}>Assignments</Link>
          </li>
          <li>
            <Link href={courseHref(courseId, 'grades')}>Marks</Link>
          </li>
          <li>
            <Link href={courseHref(courseId, 'people')}>People</Link>
          </li>
          <li>
            <Link href={assist}>Study Assistant</Link> (demo)
          </li>
        </ul>

        <h2>Modules snapshot</h2>
        <div className="ic-table-wrap mt-3 overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <table className="ic-data-table w-full text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Module</th>
                <th className="px-4 py-2 text-left font-semibold">Items</th>
                <th className="px-4 py-2 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {modules.map((m) => (
                <tr key={m.id} className="border-t border-neutral-100">
                  <td className="px-4 py-3">
                    <Link href={mod} className="text-[#146ebd] hover:underline">
                      {m.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{m.items}</td>
                  <td className="px-4 py-3 capitalize">{m.state}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (courseId !== FEATURE_COURSE_ID) {
    return (
      <div className="user_content">
        <h1 className="ic-page-h1">Course</h1>
        <p className="mt-2 text-sm text-neutral-700">
          No demo card exists for course ID <code className="rounded bg-neutral-100 px-1">{courseId}</code>.
        </p>
        <p className="mt-4 text-sm">
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
  const modulesLink = courseHref(courseId, 'modules');
  const peopleLink = courseHref(courseId, 'people');
  const assignmentsLink = courseHref(courseId, 'assignments');

  return (
    <div className="user_content">
      <div className="mb-6 rounded border border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-600">
        Banner image placeholder (course hero loads here in Canvas).
      </div>

      <h2>How to engage with this course</h2>
      <ul style={{ listStyleType: 'disc' }}>
        <li>
          Read your <Link href={modulesLink}>Class summary</Link> and the <Link href={peopleLink}>Course contacts</Link>
        </li>
        <li>
          Read <Link href={modulesLink}>Course Outline</Link>.
        </li>
        <li>
          Get familiar with the information in the <Link href={modulesLink}>Course information</Link> module
        </li>
        <li>Check Announcements and Discussions regularly</li>
        <li>
          Engage with course content for each week or topic in the <Link href={modulesLink}>Modules</Link>
        </li>
        <li>
          Check your <Link href={assignmentsLink}>Assessments</Link> regularly
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
        The following table gives you information and links to what you will be doing each week. Please note: The content of
        each module might not be available until just before it is due to begin.
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
        <Link href={mat}>readings index</Link>, and <Link href={qui}>practice quizzes</Link> when your materials are synced.
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
