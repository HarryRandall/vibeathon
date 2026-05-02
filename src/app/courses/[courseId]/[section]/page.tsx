import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  getAnnouncementsForCourse,
  getAssignmentsForCourse,
  getCourseMeta,
  getDiscussionsForCourse,
  getGradesForCourse,
  getModulesForCourse,
  getPeopleForCourse,
} from '@/lib/dummy-data';

const SECTIONS = [
  'modules',
  'announcements',
  'discussions',
  'recordings',
  'assignments',
  'grades',
  'people',
  'ed-discussion',
] as const;

type Section = (typeof SECTIONS)[number];

export default function CourseSectionPage({ params }: { params: { courseId: string; section: string } }) {
  const { courseId, section } = params;
  if (!SECTIONS.includes(section as Section)) notFound();

  const meta = getCourseMeta(courseId);
  const courseLabel = meta?.shortName ?? `Course ${courseId}`;
  const courseCode = meta?.courseCode ?? courseId;

  const wrap = (title: string, inner: ReactNode) => (
    <div className="user_content">
      <p className="ic-course-crumb-label text-sm text-neutral-600">
        <Link href={`/courses/${courseId}`} className="text-[#146ebd] hover:underline">
          {courseCode}
        </Link>{' '}
        · {courseLabel}
      </p>
      <h1 className="ic-page-h1">{title}</h1>
      {inner}
    </div>
  );

  switch (section as Section) {
    case 'modules': {
      const rows = getModulesForCourse(courseId);
      return wrap(
        'Modules',
        <div className="ic-table-wrap mt-4 overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <table className="ic-data-table w-full text-sm">
            <thead className="bg-neutral-50 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold">Module</th>
                <th className="px-4 py-3 font-semibold">Items</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-neutral-100">
                  <td className="px-4 py-3">{r.name}</td>
                  <td className="px-4 py-3">{r.items}</td>
                  <td className="px-4 py-3 capitalize text-neutral-600">{r.state}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    }
    case 'announcements': {
      const rows = getAnnouncementsForCourse(courseId);
      return wrap(
        'Announcements',
        <ul className="mt-6 space-y-6">
          {rows.map((a) => (
            <li key={a.id} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold text-neutral-900">{a.title}</h2>
                <span className="text-xs text-neutral-500">{a.date}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-neutral-700">{a.body}</p>
            </li>
          ))}
        </ul>,
      );
    }
    case 'discussions': {
      const rows = getDiscussionsForCourse(courseId);
      return wrap(
        'Discussions',
        <ul className="mt-4 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
          {rows.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span className="font-medium text-[#146ebd]">{d.topic}</span>
              <span className="text-neutral-500">{d.replies} replies · last activity {d.last}</span>
            </li>
          ))}
        </ul>,
      );
    }
    case 'recordings':
      return wrap(
        'Class Recordings',
        <div className="mt-4 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-6 text-sm text-neutral-700">
          <p>
            EchoVideo / Echo360 embed would appear here in Canvas. Demo links: Week 5 lecture recording · Tutorial
            capture · Guest seminar (optional).
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5">
            <li>Week 5 — Rasterisation (52 min)</li>
            <li>Week 6 — Animation overview (48 min)</li>
            <li>Lab walkthrough — C-Lab-3 (35 min)</li>
          </ul>
        </div>,
      );
    case 'assignments': {
      const rows = getAssignmentsForCourse(courseId);
      return wrap(
        'Assignments',
        <div className="ic-table-wrap mt-4 overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <table className="ic-data-table w-full text-sm">
            <thead className="bg-neutral-50 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold">Assignment</th>
                <th className="px-4 py-3 font-semibold">Due</th>
                <th className="px-4 py-3 font-semibold">Pts</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-neutral-100">
                  <td className="px-4 py-3">{r.name}</td>
                  <td className="px-4 py-3">{r.due}</td>
                  <td className="px-4 py-3">{r.pts}</td>
                  <td className="px-4 py-3 capitalize">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    }
    case 'grades': {
      const rows = getGradesForCourse(courseId);
      return wrap(
        'Marks',
        <div className="ic-table-wrap mt-4 overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <table className="ic-data-table w-full text-sm">
            <thead className="bg-neutral-50 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold">Assignment</th>
                <th className="px-4 py-3 font-semibold">Score</th>
                <th className="px-4 py-3 font-semibold">Submitted / status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-neutral-100">
                  <td className="px-4 py-3">{r.assignment}</td>
                  <td className="px-4 py-3">{r.score}</td>
                  <td className="px-4 py-3">{r.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-neutral-100 px-4 py-3 text-xs text-neutral-500">
            Final grades follow ANU policy; provisional marks only until released by the convenor.
          </p>
        </div>,
      );
    }
    case 'people':
      return wrap(
        'People',
        <div className="ic-table-wrap mt-4 overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <table className="ic-data-table w-full text-sm">
            <thead className="bg-neutral-50 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
              </tr>
            </thead>
            <tbody>
              {getPeopleForCourse(courseId).map((p, i) => (
                <tr key={i} className="border-t border-neutral-100">
                  <td className="px-4 py-3">{p.role}</td>
                  <td className="px-4 py-3">{p.name}</td>
                  <td className="px-4 py-3 text-[#146ebd]">{p.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    case 'ed-discussion':
      return wrap(
        'Ed Discussion',
        <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-6 text-sm leading-relaxed text-neutral-700 shadow-sm">
          <p>
            Ed Discussion opens in an LTI frame in production. For this demo, use the{' '}
            <Link href={`/courses/${courseId}/discussions`} className="text-[#146ebd] underline">
              Canvas Discussions
            </Link>{' '}
            tab or continue technical threads in your weekly tutorial.
          </p>
        </div>,
      );
    default:
      notFound();
  }
}
