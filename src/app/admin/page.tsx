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
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow p-8">
        <h1 className="text-2xl font-bold mb-1">Admin upload</h1>
        <p className="text-sm text-gray-500 mb-6">Testing-only route — no auth.</p>
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
    </main>
  );
}
