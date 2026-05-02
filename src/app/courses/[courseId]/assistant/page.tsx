import { StudySession } from '@/components/StudySession';
import { getStudySessionServerProps } from '@/lib/study/session-server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AssistantPage({
  params,
  searchParams,
}: {
  params: { courseId: string };
  searchParams?: { tab?: string };
}) {
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

  const initialTab = searchParams?.tab === 'quiz' ? 'quiz' : 'ask';

  return (
    <div className="assistant-tool user_content flex min-h-0 flex-1 flex-col gap-4">
      <div className="border-b border-anu-border pb-4">
        <h1 className="text-lg font-semibold text-slate-900">Study Assistant</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Ask questions grounded in your Canvas modules after you load materials. Practice quizzes use the same indexed
          content. Requires <code className="rounded bg-slate-100 px-1">CANVAS_TOKEN</code>,{' '}
          <code className="rounded bg-slate-100 px-1">CANVAS_BASE_URL</code>, and{' '}
          <code className="rounded bg-slate-100 px-1">OPENAI_API_KEY</code> on the server.
        </p>
      </div>
      <StudySession {...props} initialTab={initialTab} />
    </div>
  );
}
