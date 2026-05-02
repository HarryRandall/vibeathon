import { NextResponse } from 'next/server';
import { listModules } from '@/lib/canvas-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseWeekNumber(name: string, fallback: number) {
  const match = name.match(/week\s*(\d{1,2})/i);
  return match ? Number(match[1]) : fallback;
}

export async function GET(_req: Request, { params }: { params: { courseId: string } }) {
  const token = process.env.CANVAS_TOKEN;
  if (!token) return NextResponse.json({ error: 'CANVAS_TOKEN missing' }, { status: 500 });

  try {
    const modules = await listModules(token, params.courseId);
    const weeks = modules.map((module, index) => ({
      id: String(module.id),
      week_number: parseWeekNumber(module.name, index + 1),
      title: module.name,
      position: module.position,
    }));
    return NextResponse.json({ courseId: params.courseId, weeks });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
