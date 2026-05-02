// Internal "study assistant" types — what the ingester produces and the
// retrieval layer consumes.

export type SourceKind = "page" | "pdf" | "assignment" | "subheader_context";

export type Document = {
  id: string; // stable id: `${courseId}-${kind}-${nativeId}`
  courseId: number;
  kind: SourceKind;
  title: string;
  moduleName: string | null;
  modulePosition: number | null;
  url: string; // canvas html_url for clickable citation
  text: string;
  fetchedAt: string;
  // Optional metadata for diagnostics / UI
  pageCount?: number;
  charCount: number;
  notes?: string[];
};

export type Chunk = {
  id: string; // `${docId}-${idx}`
  documentId: string;
  index: number;
  text: string;
  // Embedding is stored separately to keep JSON serialization small.
};

export type CourseCorpus = {
  courseId: number;
  courseCode: string;
  courseName: string;
  ingestedAt: string;
  documents: Document[];
  chunks: Chunk[];
  embeddings: Float32Array[]; // aligned with chunks by index
  embeddingModel: string;
  // Items we knew about but couldn't ingest (skipped types, parse failures, etc.)
  skipped: { itemTitle: string; reason: string }[];
};

export type IngestProgress = {
  courseId: number;
  status: "idle" | "running" | "ready" | "error";
  step?: string;
  itemsTotal?: number;
  itemsDone?: number;
  documentsCount?: number;
  chunksCount?: number;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
};

export type RetrievalHit = {
  chunk: Chunk;
  document: Document;
  score: number;
};
