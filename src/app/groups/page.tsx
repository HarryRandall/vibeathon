import Link from 'next/link';
import { DEMO_GROUPS } from '@/lib/dummy-data';

export default function GroupsPage() {
  return (
    <div className="user_content">
      <h1 className="ic-page-h1">Groups</h1>
      <p className="mt-2 text-sm text-neutral-600">Study and project groups you belong to this semester.</p>
      <ul className="mt-6 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
        {DEMO_GROUPS.map((g) => (
          <li key={g.id}>
            <Link href={g.href} className="flex flex-wrap items-center justify-between gap-2 px-4 py-4 text-sm hover:bg-neutral-50">
              <span className="font-medium text-[#146ebd]">{g.name}</span>
              <span className="text-neutral-500">{g.courseLabel}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
