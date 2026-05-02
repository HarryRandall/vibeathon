import Link from 'next/link';
import { DEMO_HISTORY } from '@/lib/dummy-data';

export default function HistoryPage() {
  return (
    <div className="user_content">
      <h1 className="ic-page-h1">History</h1>
      <p className="mt-2 text-sm text-neutral-600">Recently viewed pages in this demo session.</p>
      <ul className="mt-6 space-y-3">
        {DEMO_HISTORY.map((h) => (
          <li key={h.id}>
            <Link href={h.href} className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm shadow-sm hover:bg-neutral-50">
              <span className="font-medium text-[#146ebd]">{h.label}</span>
              <span className="text-xs text-neutral-500">{h.when}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
