import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DEMO_GROUPS } from '@/lib/dummy-data';

export default function GroupDetailPage({ params }: { params: { groupId: string } }) {
  const g = DEMO_GROUPS.find((x) => x.id === params.groupId);
  if (!g) notFound();

  return (
    <div className="user_content">
      <p className="text-sm text-neutral-600">
        <Link href="/groups" className="text-[#146ebd] hover:underline">
          Groups
        </Link>{' '}
        › {g.name}
      </p>
      <h1 className="ic-page-h1 mt-2">{g.name}</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Linked course context: <strong>{g.courseLabel}</strong>
      </p>
      <div className="mt-8 rounded-lg border border-neutral-200 bg-white p-6 text-sm shadow-sm">
        <h2 className="font-semibold text-neutral-900">Group home</h2>
        <p className="mt-3 leading-relaxed text-neutral-700">
          Files, announcements, and collaborations for this group would appear here. Demo content only — no messaging backend.
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-neutral-700">
          <li>Shared folder: project brief & rubric (PDF)</li>
          <li>Next sync: Fri 10:00 am — CSIT lab</li>
        </ul>
      </div>
    </div>
  );
}
