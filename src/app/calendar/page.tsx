import { DEMO_CALENDAR_EVENTS } from '@/lib/dummy-data';

export default function CalendarPage() {
  return (
    <div className="user_content">
      <h1 className="ic-page-h1">Calendar</h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-600">
        Week-at-a-glance (demo). Colours and course links mirror how CanvasPlanner surfaces deadlines.
      </p>
      <div className="ic-table-wrap mt-6 overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="ic-data-table w-full text-sm">
          <thead className="bg-neutral-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Day</th>
              <th className="px-4 py-3 font-semibold">Time</th>
              <th className="px-4 py-3 font-semibold">Event</th>
              <th className="px-4 py-3 font-semibold">Course</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_CALENDAR_EVENTS.map((e) => (
              <tr key={e.id} className="border-t border-neutral-100">
                <td className="px-4 py-3">{e.dayLabel}</td>
                <td className="px-4 py-3">{e.time}</td>
                <td className="px-4 py-3">{e.title}</td>
                <td className="px-4 py-3">{e.course}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
