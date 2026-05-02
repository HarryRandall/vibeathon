import Link from 'next/link';
import { CourseHomeView } from '@/components/course/course-page';
import { getCourseHomePageData } from '@/lib/course-content';

export default function CourseHomePage({ params }: { params: { courseId: string } }) {
  const courseId = params.courseId;
  const content = getCourseHomePageData(courseId);

  if (content) {
    return <CourseHomeView data={content} />;
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
