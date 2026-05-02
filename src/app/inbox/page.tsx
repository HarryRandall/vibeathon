import { DEMO_INBOX } from '@/lib/dummy-data';

export default function InboxPage() {
  return (
    <div className="user_content">
      <h1 className="ic-page-h1">Inbox</h1>
      <p className="mt-2 text-sm text-neutral-600">Conversations with instructors and classmates (demo threads).</p>
      <ul className="mt-6 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
        {DEMO_INBOX.map((t) => (
          <li key={t.id} className={`px-4 py-4 text-sm ${t.unread ? 'bg-blue-50/50' : ''}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-semibold text-neutral-900">{t.subject}</span>
              <span className="text-xs text-neutral-500">{t.timeLabel}</span>
            </div>
            <p className="mt-1 text-xs text-neutral-500">{t.course}</p>
            <p className="mt-2 line-clamp-2 text-neutral-700">{t.preview}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
