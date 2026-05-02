'use client';

import { useState } from 'react';

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export default function AdminPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setStatus('uploading');
    setMessage('');

    const form = new FormData();
    form.append('file', file);

    const res = await fetch('/api/upload', { method: 'POST', body: form });
    const data = await res.json();

    if (!res.ok) {
      setStatus('error');
      setMessage(data.error ?? 'Upload failed');
      return;
    }

    setStatus('success');
    setMessage(`Uploaded: ${data.document.name} (id ${data.document.id})`);
    setFile(null);
  }

  return (
    <div className="user_content">
      <h1 className="ic-page-h1">Admin upload</h1>
      <p className="mt-2 max-w-xl text-sm text-neutral-600">Testing-only route — no auth. Uses the same Canvas shell as the rest of the demo.</p>
      <div className="mx-auto mt-8 w-full max-w-md rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">Upload a document</h2>
        <p className="mt-1 text-sm text-neutral-500 mb-6">Files are processed by the configured backend when present.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
            onClick={() => document.getElementById('file-input')?.click()}
          >
            {file ? (
              <p className="text-sm text-gray-700 font-medium">{file.name}</p>
            ) : (
              <p className="text-sm text-gray-400">Click to select a file</p>
            )}
            <input
              id="file-input"
              type="file"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {message && (
            <p className={`text-sm ${status === 'error' ? 'text-red-600' : 'text-green-600'}`}>
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={!file || status === 'uploading'}
            className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {status === 'uploading' ? 'Uploading…' : 'Upload'}
          </button>
        </form>
      </div>
    </div>
  );
}
