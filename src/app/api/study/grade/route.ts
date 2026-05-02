import { NextResponse } from "next/server";
import { gradeAnswer } from "@/lib/study/grade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const courseId = Number(body.courseId);
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const expectedAnswer = typeof body.expectedAnswer === "string" ? body.expectedAnswer.trim() : "";
    const studentAnswer = typeof body.studentAnswer === "string" ? body.studentAnswer.trim() : "";

    if (!courseId) {
      return NextResponse.json({ error: "bad_request", message: "courseId required" }, { status: 400 });
    }
    if (!question || !expectedAnswer) {
      return NextResponse.json({ error: "bad_request", message: "question and expectedAnswer required" }, { status: 400 });
    }
    if (!studentAnswer) {
      return NextResponse.json({ error: "bad_request", message: "studentAnswer empty" }, { status: 400 });
    }

    const out = await gradeAnswer({ courseId, question, expectedAnswer, studentAnswer });
    return NextResponse.json(out);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "grade_failed", message }, { status: 500 });
  }
}
