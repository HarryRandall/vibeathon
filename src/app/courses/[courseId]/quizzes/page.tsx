import { StudySession } from '@/components/StudySession';
import { getStudySessionServerProps } from '@/lib/study/session-server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function QuizzesPage({ params }: { params: { courseId: string } }) {
  const props = await getStudySessionServerProps(params.courseId);
  if (!props) {
    return (
      <div className="user_content">
        <p className="text-sm text-neutral-700">Invalid course ID.</p>
        <Link href="/" className="mt-4 inline-block text-sm text-[#146ebd] underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="user_content mx-auto max-w-6xl">
      <div className="mb-6 border-b border-anu-border pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Practice quizzes</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Exam-style questions generated from your ingested course materials. Uses the same index as Study Assistant — load
          materials first if you have not already.
        </p>
      </div>
      <StudySession {...props} initialTab="quiz" />
    </div>
  );
}
