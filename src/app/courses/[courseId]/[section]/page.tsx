import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import CanvasModulesList from '@/components/canvas/modules-list';
import { getCourseMeta, getAnnouncementsForCourse, getAssignmentsForCourse, getDiscussionsForCourse, getGradesForCourse, getPeopleForCourse } from '@/lib/dummy-data';
import { COURSE_CONTENT_SECTIONS, type CourseContentSection, getCanvasModulesForCourse } from '@/lib/course-content';

export default function CourseSectionPage({ params }: { params: { courseId: string; section: string } }) {
  const { courseId, section } = params;
  if (!COURSE_CONTENT_SECTIONS.includes(section as CourseContentSection)) notFound();

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

  switch (section as CourseContentSection) {
    case 'modules': {
      const modules = getCanvasModulesForCourse(courseId);
      return <CanvasModulesList courseId={courseId} modules={modules} />;
    }
    case 'announcements':
      return wrap(
        'Announcements',
        <ul className="mt-6 space-y-6">
          {getAnnouncementsForCourse(courseId).map((announcement) => (
            <li key={announcement.id} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold text-neutral-900">{announcement.title}</h2>
                <span className="text-xs text-neutral-500">{announcement.date}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-neutral-700">{announcement.body}</p>
            </li>
          ))}
        </ul>,
      );
    case 'discussions':
      return wrap(
        'Discussions',
        <ul className="mt-4 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
          {getDiscussionsForCourse(courseId).map((discussion) => (
            <li key={discussion.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span className="font-medium text-[#146ebd]">{discussion.topic}</span>
              <span className="text-neutral-500">
                {discussion.replies} replies · last activity {discussion.last}
              </span>
            </li>
          ))}
        </ul>,
      );
    case 'recordings':
      return wrap(
        'Class Recordings',
        <div className="mt-4 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-6 text-sm text-neutral-700">
          <p>EchoVideo / Echo360 embed would appear here in Canvas. Demo links: Week 5 lecture recording · Tutorial capture · Guest seminar (optional).</p>
          <ul className="mt-4 list-disc space-y-2 pl-5">
            <li>Week 5 — Rasterisation (52 min)</li>
            <li>Week 6 — Animation overview (48 min)</li>
            <li>Lab walkthrough — C-Lab-3 (35 min)</li>
          </ul>
        </div>,
      );
    case 'assignments':
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
              {getAssignmentsForCourse(courseId).map((assignment, index) => (
                <tr key={index} className="border-t border-neutral-100">
                  <td className="px-4 py-3">{assignment.name}</td>
                  <td className="px-4 py-3">{assignment.due}</td>
                  <td className="px-4 py-3">{assignment.pts}</td>
                  <td className="px-4 py-3 capitalize">{assignment.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    case 'grades':
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
              {getGradesForCourse(courseId).map((grade, index) => (
                <tr key={index} className="border-t border-neutral-100">
                  <td className="px-4 py-3">{grade.assignment}</td>
                  <td className="px-4 py-3">{grade.score}</td>
                  <td className="px-4 py-3">{grade.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-neutral-100 px-4 py-3 text-xs text-neutral-500">
            Final grades follow ANU policy; provisional marks only until released by the convenor.
          </p>
        </div>,
      );
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
              {getPeopleForCourse(courseId).map((person, index) => (
                <tr key={index} className="border-t border-neutral-100">
                  <td className="px-4 py-3">{person.role}</td>
                  <td className="px-4 py-3">{person.name}</td>
                  <td className="px-4 py-3 text-[#146ebd]">{person.email}</td>
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
  }
}
