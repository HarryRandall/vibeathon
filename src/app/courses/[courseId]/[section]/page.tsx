import { notFound } from 'next/navigation';
import { getCourseMeta } from '@/lib/dummy-data';
import { COURSE_CONTENT_SECTIONS, type CourseContentSection, getCourseSectionPageData } from '@/lib/course-content';
import { CourseSectionView } from '@/components/course/course-page';

export default function CourseSectionPage({ params }: { params: { courseId: string; section: string } }) {
  const { courseId, section } = params;
  if (!COURSE_CONTENT_SECTIONS.includes(section as CourseContentSection)) notFound();

  const meta = getCourseMeta(courseId);
  const courseLabel = meta?.shortName ?? `Course ${courseId}`;
  const courseCode = meta?.courseCode ?? courseId;
  const data = getCourseSectionPageData(courseId, section as CourseContentSection);

  return (
    <CourseSectionView
      courseCode={courseCode}
      courseLabel={courseLabel}
      courseHomeHref={`/courses/${courseId}`}
      data={data}
    />
  );
}
