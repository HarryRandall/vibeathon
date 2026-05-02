import { NextResponse } from 'next/server';
import { listCourses } from '@/lib/canvas-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const token = process.env.CANVAS_TOKEN;
  if (!token) return NextResponse.json({ error: 'CANVAS_TOKEN missing' }, { status: 500 });
  try {
    const courses = await listCourses(token);
    return NextResponse.json({ courses });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
