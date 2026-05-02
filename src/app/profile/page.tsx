import { DEMO_USER } from '@/lib/dummy-data';

export default function ProfilePage() {
  return (
    <div className="user_content">
      <h1 className="ic-page-h1">Account</h1>
      <div className="ic-profile-grid mt-6 max-w-xl rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="font-semibold text-neutral-600">Display name</dt>
            <dd>{DEMO_USER.displayName}</dd>
          </div>
          <div>
            <dt className="font-semibold text-neutral-600">Sortable name</dt>
            <dd>{DEMO_USER.sortableName}</dd>
          </div>
          <div>
            <dt className="font-semibold text-neutral-600">Email</dt>
            <dd>
              <a href={`mailto:${DEMO_USER.email}`} className="text-[#146ebd] hover:underline">
                {DEMO_USER.email}
              </a>
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-neutral-600">Pronouns</dt>
            <dd>{DEMO_USER.pronouns}</dd>
          </div>
          <div>
            <dt className="font-semibold text-neutral-600">Time zone</dt>
            <dd>{DEMO_USER.timezone}</dd>
          </div>
        </dl>
        <p className="mt-6 text-xs text-neutral-500">Demo profile — SSO and settings would load here in production Canvas.</p>
      </div>
    </div>
  );
}
