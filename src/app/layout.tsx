import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import CanvasShell from '@/components/canvas-shell';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Study Assistant',
  description: 'Canvas-linked smart study assistant — summaries, Q&A, and practice quizzes.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} min-h-screen antialiased`}>
        <CanvasShell>{children}</CanvasShell>
      </body>
    </html>
  );
}
