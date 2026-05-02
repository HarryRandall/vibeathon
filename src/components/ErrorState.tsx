export function ErrorState({
  title,
  message,
  hint,
}: {
  title: string;
  message: string;
  hint?: string;
}) {
  return (
    <div className="mx-auto mt-12 max-w-xl rounded-2xl border border-red-200 bg-red-50 p-8">
      <h2 className="text-lg font-semibold text-red-900">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-red-800">{message}</p>
      {hint && (
        <p className="mt-4 rounded-lg bg-white p-3 text-xs leading-relaxed text-red-700">
          {hint}
        </p>
      )}
    </div>
  );
}

export function SetupNeeded() {
  return (
    <div className="mx-auto mt-12 max-w-2xl rounded-2xl border border-anu-border bg-white p-8 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-anu-gold">Setup</p>
      <h2 className="mt-2 text-2xl font-semibold text-anu-ink">
        Add your Canvas + OpenAI keys to <code className="font-mono text-base">.env.local</code>
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-700">
        Copy <code className="font-mono">.env.local.example</code> to{" "}
        <code className="font-mono">.env.local</code> and fill in:
      </p>
      <ul className="mt-3 space-y-1 text-sm text-zinc-700">
        <li>
          • <code className="font-mono">CANVAS_TOKEN</code> — Canvas → Account → Settings →
          New Access Token
        </li>
        <li>
          • <code className="font-mono">OPENAI_API_KEY</code> — platform.openai.com/api-keys
        </li>
      </ul>
      <p className="mt-4 text-xs text-zinc-500">
        Restart <code className="font-mono">npm run dev</code> after editing the file.
      </p>
    </div>
  );
}
