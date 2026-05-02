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

  const initialTab =
    searchParams?.tab === 'quiz' ? 'quiz' : searchParams?.tab === 'materials' ? 'materials' : 'ask';
  const hasIndexedContent = props.initiallyIngested && props.initialDocuments.length > 0;

  return (
    <div className="assistant-tool user_content flex min-h-0 flex-1 flex-col gap-4">
      <div className="border-b border-anu-border pb-4">
        <h1 className="text-lg font-semibold text-slate-900">Course tools</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Ask questions grounded in your imported Canvas modules and generate practice quizzes from the same indexed
          material.
        </p>
      </div>
      {hasIndexedContent ? (
        <StudySession {...props} initialTab={initialTab} />
      ) : (
        <section className="canvas-section-card max-w-3xl">
          <div className="canvas-section-card__header">
            <h2>No study materials imported yet</h2>
            <p>
              This course does not have indexed pages, files, or assignment briefs in Supabase yet. Import the course
              content from the admin page before using these tools.
            </p>
          </div>
          <Link href="/admin" className="btn inline-block">
            Go to Admin Import
          </Link>
        </section>
      )}
    </div>
  );
}
