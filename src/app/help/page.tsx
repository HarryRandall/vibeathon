export default function HelpPage() {
  return (
    <div className="user_content">
      <h1 className="ic-page-h1">Help</h1>
      <div className="mt-6 max-w-2xl space-y-6 text-sm leading-relaxed text-neutral-800">
        <section>
          <h2 className="text-base font-semibold text-neutral-900">Canvas basics</h2>
          <p className="mt-2">
            Use the <strong>Dashboard</strong> to open courses. Inside a course, the left menu jumps to Modules,
            Assignments, Marks, and tools your institution enables.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-neutral-900">Need real support?</h2>
          <p className="mt-2">
            Contact your course convenor or ANU IT; this page is static demo copy only.
          </p>
        </section>
      </div>
    </div>
  );
}
