import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ANU Course Study Assistant",
  description: "Ask questions and generate practice quizzes grounded in your real Canvas course materials — lecture slides, module pages, assignment briefs.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-anu-paper text-anu-ink antialiased">
        {children}
      </body>
    </html>
  );
}
