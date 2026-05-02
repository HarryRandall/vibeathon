import { NextResponse } from "next/server";
import { generateQuiz } from "@/lib/study/quiz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const courseId = Number(body.courseId);
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    const count = Math.min(Math.max(Number(body.count) || 5, 1), 12);

    if (!courseId) {
      return NextResponse.json({ error: "bad_request", message: "courseId required" }, { status: 400 });
    }
    if (!topic) {
      return NextResponse.json({ error: "bad_request", message: "topic required" }, { status: 400 });
    }

    const result = await generateQuiz({ courseId, topic, count });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "quiz_failed", message }, { status: 500 });
  }
}
