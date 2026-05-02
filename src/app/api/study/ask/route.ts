import { NextResponse } from "next/server";
import { askWithContext } from "@/lib/study/ask";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const courseId = Number(body.courseId);
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const history = Array.isArray(body.history) ? body.history : undefined;

    if (!courseId) {
      return NextResponse.json({ error: "bad_request", message: "courseId required" }, { status: 400 });
    }
    if (!question) {
      return NextResponse.json({ error: "bad_request", message: "question required" }, { status: 400 });
    }

    const { stream, sources, modelUsed } = await askWithContext({
      courseId,
      question,
      history,
      signal: req.signal,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Sources": Buffer.from(JSON.stringify(sources)).toString("base64"),
        "X-Model": modelUsed,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "ask_failed", message }, { status: 500 });
  }
}
