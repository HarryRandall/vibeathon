import type { Metadata } from "next";
import { Lato } from "next/font/google";
import CanvasShell from "@/components/canvas-shell";
import "./globals.css";

const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-lato",
});

export const metadata: Metadata = {
  title: { default: "ANU Study Assistant", template: "%s · Canvas" },
  description: "Ask questions and generate practice quizzes grounded in your real Canvas course materials.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-AU" className={lato.variable}>
      <body className={`${lato.className} min-h-screen antialiased`}>
        <CanvasShell>{children}</CanvasShell>
      </body>
    </html>
  );
}
