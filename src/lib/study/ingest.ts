import "server-only";

import type { CanvasClient } from "@/lib/canvas/client";
import type {
  CanvasModule,
  CanvasModuleItem,
} from "@/lib/canvas/types";
import { chunkText } from "./chunker";
import { embedTexts } from "./embeddings";
import { extractPdfText } from "./pdf";
import { htmlToText } from "./html";
import { studyStore } from "./store";
import type {
  Chunk,
  CourseCorpus,
  Document,
  IngestProgress,
} from "./types";

const MIN_TEXT_LEN = 80; // skip near-empty docs (image-only PDFs etc.)

// Limits to keep ingestion bounded for the demo.
const MAX_PDFS = 60;
const MAX_PDF_BYTES = 25 * 1024 * 1024; // 25MB
const SUPPORTED_FILE_EXTS = [".pdf"]; // pptx/docx/zip skipped for v1

function fileExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

function isPdf(item: CanvasModuleItem): boolean {
  return item.type === "File" && fileExt(item.title || "").endsWith(".pdf");
}

type CourseRef = { id: number; code: string; name: string };

export async function ingestCourse(
  client: CanvasClient,
  course: CourseRef,
): Promise<CourseCorpus> {
  const startedAt = new Date().toISOString();
  const setProgress = (patch: Partial<IngestProgress>) => {
    studyStore.setProgress({
      ...studyStore.getProgress(course.id),
      courseId: course.id,
      startedAt,
      status: patch.status ?? "running",
      ...patch,
    });
  };

  setProgress({ status: "running", step: "fetching modules" });

  let modules: CanvasModule[];
  try {
    modules = await client.getCourseModules(course.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setProgress({ status: "error", error: `Failed to fetch modules: ${message}`, finishedAt: new Date().toISOString() });
    throw err;
  }

  const itemsTotal = modules.reduce((sum, m) => sum + (m.items?.length ?? 0), 0);
  setProgress({ step: "scanning items", itemsTotal, itemsDone: 0 });

  const documents: Document[] = [];
  const skipped: { itemTitle: string; reason: string }[] = [];
  let pdfCount = 0;
  let processed = 0;

  for (const mod of modules) {
    // Canvas only inlines items when include[]=items is honoured server-side.
    // For some course configs (locked modules, older API versions) the field is
    // absent entirely — fall back to a separate items request in that case.
    let items = mod.items;
    if (items === undefined || items === null) {
      try {
        items = await client.getModuleItems(course.id, mod.id);
      } catch (err) {
        console.warn(`[ingest] could not fetch items for module ${mod.id} "${mod.name}":`, err);
        items = [];
      }
    }
    for (const item of items) {
      processed += 1;
      setProgress({ itemsDone: processed, step: `processing ${item.type}: ${item.title}` });

      try {
        if (item.type === "Page" && item.page_url) {
          const page = await client.getPage(course.id, item.page_url);
          const text = htmlToText(page.body);
          if (text.length >= MIN_TEXT_LEN) {
            documents.push({
              id: `${course.id}-page-${page.page_id ?? item.id}`,
              courseId: course.id,
              kind: "page",
              title: page.title || item.title,
              moduleName: mod.name,
              modulePosition: mod.position,
              url: page.html_url || item.html_url || "",
              text,
              fetchedAt: new Date().toISOString(),
              charCount: text.length,
            });
          } else {
            skipped.push({ itemTitle: item.title, reason: "page too short" });
          }
          continue;
        }

        if (isPdf(item) && item.content_id) {
          if (pdfCount >= MAX_PDFS) {
            skipped.push({ itemTitle: item.title, reason: `MAX_PDFS=${MAX_PDFS} reached` });
            continue;
          }
          const fileMeta = await client.getFile(item.content_id);
          if (fileMeta.size > MAX_PDF_BYTES) {
            skipped.push({ itemTitle: item.title, reason: `>${(MAX_PDF_BYTES / 1024 / 1024).toFixed(0)}MB` });
            continue;
          }
          if (!fileMeta.url) {
            skipped.push({ itemTitle: item.title, reason: "no download url" });
            continue;
          }
          const dl = await client.download(fileMeta.url);
          let extracted;
          try {
            extracted = await extractPdfText(dl.buffer);
          } catch (err) {
            skipped.push({
              itemTitle: item.title,
              reason: `pdf parse error: ${err instanceof Error ? err.message : String(err)}`,
            });
            continue;
          }
          pdfCount += 1;
          if (extracted.text.length < MIN_TEXT_LEN) {
            skipped.push({ itemTitle: item.title, reason: "image-only PDF (no extractable text)" });
            continue;
          }
          documents.push({
            id: `${course.id}-pdf-${item.content_id}`,
            courseId: course.id,
            kind: "pdf",
            title: item.title,
            moduleName: mod.name,
            modulePosition: mod.position,
            url: item.html_url || `${client.baseUrl}/courses/${course.id}/files/${item.content_id}`,
            text: extracted.text,
            pageCount: extracted.pages,
            fetchedAt: new Date().toISOString(),
            charCount: extracted.text.length,
          });
          continue;
        }

        if (item.type === "Assignment" && item.content_id) {
          try {
            const a = await client.getAssignment(course.id, item.content_id);
            const text = htmlToText(a.description);
            if (text.length >= MIN_TEXT_LEN) {
              documents.push({
                id: `${course.id}-assignment-${a.id}`,
                courseId: course.id,
                kind: "assignment",
                title: a.name,
                moduleName: mod.name,
                modulePosition: mod.position,
                url: a.html_url,
                text,
                fetchedAt: new Date().toISOString(),
                charCount: text.length,
              });
            } else {
              skipped.push({ itemTitle: item.title, reason: "assignment description empty" });
            }
          } catch {
            skipped.push({ itemTitle: item.title, reason: "could not fetch assignment" });
          }
          continue;
        }

        if (item.type === "File") {
          skipped.push({ itemTitle: item.title, reason: `file type not supported (${fileExt(item.title)})` });
          continue;
        }

        if (item.type === "SubHeader") {
          // Section header — ignore silently, no info to skip-report.
          continue;
        }

        skipped.push({ itemTitle: item.title, reason: `type=${item.type} not ingested` });
      } catch (err) {
        skipped.push({
          itemTitle: item.title,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  setProgress({ step: "chunking", documentsCount: documents.length });

  const chunks: Chunk[] = [];
  const docOffsets: { docId: string; start: number; end: number }[] = [];
  for (const doc of documents) {
    const pieces = chunkText(doc.text);
    const start = chunks.length;
    pieces.forEach((text, idx) => {
      chunks.push({
        id: `${doc.id}-${idx}`,
        documentId: doc.id,
        index: idx,
        text,
      });
    });
    docOffsets.push({ docId: doc.id, start, end: chunks.length });
  }

  setProgress({ step: `embedding 0/${chunks.length} chunks`, chunksCount: chunks.length });

  const embeddings: Float32Array[] = new Array(chunks.length);
  const keptDocIds = new Set<string>();
  let embeddedCount = 0;

  for (const span of docOffsets) {
    const slice = chunks.slice(span.start, span.end).map((c) => c.text);
    if (slice.length === 0) continue;
    try {
      const vectors = await embedTexts(slice);
      for (let i = 0; i < vectors.length; i++) {
        embeddings[span.start + i] = vectors[i];
      }
      keptDocIds.add(span.docId);
      embeddedCount += slice.length;
      setProgress({ step: `embedding ${embeddedCount}/${chunks.length} chunks`, chunksCount: chunks.length });
    } catch (err) {
      console.error(`[ingest] embedding failed for ${span.docId}:`, err);
      const docTitle = documents.find((d) => d.id === span.docId)?.title ?? span.docId;
      skipped.push({
        itemTitle: docTitle,
        reason: `embedding failed (${err instanceof Error ? err.message : String(err)})`,
      });
    }
  }

  const finalDocuments = documents.filter((d) => keptDocIds.has(d.id));
  const finalChunks: Chunk[] = [];
  const finalEmbeddings: Float32Array[] = [];
  for (const span of docOffsets) {
    if (!keptDocIds.has(span.docId)) continue;
    for (let i = span.start; i < span.end; i++) {
      const v = embeddings[i];
      if (!v) continue;
      finalChunks.push(chunks[i]);
      finalEmbeddings.push(v);
    }
  }

  if (finalDocuments.length === 0) {
    const skipReasons = skipped.map((s) => `${s.itemTitle}: ${s.reason}`).slice(0, 10).join("; ");
    const detail = skipped.length
      ? `${skipped.length} item(s) skipped — ${skipReasons}`
      : "No module items were found (modules may be empty or access-restricted)";
    const errMsg = `No materials could be indexed. ${detail}`;
    setProgress({
      status: "error",
      error: errMsg,
      finishedAt: new Date().toISOString(),
    });
    throw new Error(errMsg);
  }

  const corpus: CourseCorpus = {
    courseId: course.id,
    courseCode: course.code,
    courseName: course.name,
    ingestedAt: new Date().toISOString(),
    documents: finalDocuments,
    chunks: finalChunks,
    embeddings: finalEmbeddings,
    embeddingModel: "text-embedding-3-small",
    skipped,
  };
  studyStore.setCorpus(corpus);
  setProgress({
    status: "ready",
    step: "ready",
    finishedAt: new Date().toISOString(),
    documentsCount: finalDocuments.length,
    chunksCount: finalChunks.length,
  });
  return corpus;
}
