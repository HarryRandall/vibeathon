import Link from 'next/link';
import { getCourseHomeData } from '@/lib/course-content';
import { getCourseMeta } from '@/lib/dummy-data';

export default function CourseHomePage({ params }: { params: { courseId: string } }) {
  const courseId = params.courseId;
  const meta = getCourseMeta(courseId);
  const content = getCourseHomeData(courseId);

  if (content && meta) {
    return (
      <div className="user_content">
        {content.heroImage ? (
          <p>
            <img src={content.heroImage} alt="" role="presentation" loading="lazy" />
          </p>
        ) : (
          <div className="canvas-banner-placeholder">Banner image placeholder (course hero loads here in Canvas).</div>
        )}

        {content.sections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            {section.paragraphs?.map((paragraph, index) => (
              <p key={`${section.title}-p-${index}`}>
                {paragraph === 'ANU provides Health, Safety and Wellbeing services free of charge to students.' ? (
                  <>
                    ANU provides{' '}
                    <Link href="https://www.anu.edu.au/students/health-safety-wellbeing" target="_blank" rel="noreferrer">
                      Health, Safety and Wellbeing services
                    </Link>{' '}
                    free of charge to students.
                  </>
                ) : (
                  paragraph
                )}
              </p>
            ))}
            {section.listItems ? (
              <ul style={{ listStyleType: 'disc' }}>
                {section.listItems.map((item) => (
                  <li key={item.text}>
                    {item.href ? (
                      <Link href={item.href} target={item.external ? '_blank' : undefined} rel={item.external ? 'noreferrer' : undefined}>
                        {item.text}
                      </Link>
                    ) : (
                      item.text
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
            {section.secondaryListItems ? (
              <>
                <p>{section.secondaryListLabel}</p>
                <ul>
                  {section.secondaryListItems.map((item) => (
                    <li key={item.text}>
                      {item.href ? (
                        <Link href={item.href} target={item.external ? '_blank' : undefined} rel={item.external ? 'noreferrer' : undefined}>
                          {item.text}
                        </Link>
                      ) : (
                        item.text
                      )}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {section.table ? (
              <table style={{ borderCollapse: 'collapse', width: '98%', borderColor: '#be830e' }} border={3}>
                {section.table.caption ? <caption>{section.table.caption}</caption> : null}
                <thead>
                  <tr style={{ textAlign: 'center' }}>
                    {section.table.columns.map((column) => (
                      <th key={column} scope="col">
                        <strong>{column}</strong>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.table.rows.map((row, rowIndex) => (
                    <tr key={`${section.title}-row-${rowIndex}`}>
                      {row.map((cell, cellIndex) => (
                        <td key={`${section.title}-${rowIndex}-${cellIndex}`} style={cellIndex === 0 ? { textAlign: 'center' } : undefined}>
                          {cellIndex === 0 && cell ? <strong>{cell}</strong> : cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </section>
        ))}
      </div>
    );
  }

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
