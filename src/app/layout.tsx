import type { Metadata } from 'next';
import CanvasShell from '@/components/canvas-shell';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Dashboard', template: '%s · Canvas demo' },
  description: 'Dashboard and course workspace — smart study assistant demo.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-AU">
      <body className="min-h-screen antialiased">
        <CanvasShell>{children}</CanvasShell>
      </body>
    </html>
  );
}
