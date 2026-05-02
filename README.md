# Vibeathon

An AI-powered education platform built for the ANU Build-a-thon 2026. Vibeathon reimagines the Canvas LMS experience by layering a RAG-driven Study Assistant, AI-graded practice quizzes, and a live Canvas import pipeline on top of a faithful Canvas shell UI.

## Features

### Canvas Shell UI
A pixel-faithful replica of the Canvas LMS interface built with Tailwind CSS. Includes a course dashboard, calendar, inbox, groups, profile, history, help, and per-course section pages (Announcements, Assignments, Quizzes, Modules, etc.). A dedicated `/landing` route hosts a guided three-step demo for hackathon judges.

### Admin Import Control Room (`/admin`)
Select any Canvas course, preview its numbered teaching weeks and supporting modules, then trigger a selective or full import. Progress streams over SSE in real time (queued → processing → ready) and a fallback poller keeps the status bar fresh. A per-course advisory lock prevents two imports from racing against each other. Legacy manual file upload is also available.

### RAG-powered Study Assistant (`/courses/[id]/assistant`)
Ask questions grounded in the course's imported materials. Answers stream chunk-by-chunk and include inline citations `[1]`, `[2]` linking back to the original Canvas pages, PDFs, or assignment briefs. Conversation history is maintained within the session.

### Practice Quiz Generator
Generate 3–12 exam-style questions (multiple choice or short answer) on any topic within the course. Multiple-choice answers are checked client-side; short answers are graded by a second OpenAI call that returns a 0–1 score and written feedback. Each question cites its source documents, a per-course quiz history is persisted in `localStorage`, and an "Ask follow-up →" button pre-fills the chat with the question context.

### Canvas Content Ingestion Pipeline
Fetches all modules from Canvas and processes:
- **Canvas Pages** — HTML body extracted to plain text
- **PDF files** — downloaded and parsed with `pdf-parse` (up to 60 PDFs, 25 MB each)
- **Assignment briefs** — HTML description stripped to text
- Image-only PDFs, `.pptx`, `.docx`, and `.zip` files are skipped with a logged reason

Extracted text is chunked, embedded with `text-embedding-3-small`, and stored in Supabase pgvector (with an in-memory fallback when Supabase is not configured). Personal information in Canvas content is run through an anonymiser before persistence.

### Operational Endpoints
- `/api/study/diag` — group-by-reason diagnostic for files stuck in `pending`/`failed`
- `/api/study/process-pending` — kick the queue and re-run processing on stuck files
- `/api/study/cleanup-junk` — purge junk artefacts (e.g. ZIP listings, image-only PDFs) from the index

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | [Next.js 14](https://nextjs.org/) App Router (React 18) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| Database & Storage | [Supabase](https://supabase.com/) (Postgres + pgvector + Storage + Edge Functions) |
| AI — chat & grading | [OpenAI](https://openai.com/) `gpt-4o-mini` (streaming) |
| AI — embeddings | OpenAI `text-embedding-3-small` |
| Real-time progress | Server-Sent Events (custom `lib/sse.ts`) |
| PDF parsing | `pdf-parse` |
| Markdown rendering | `react-markdown` + `remark-gfm` |
| Validation | `zod` |
| Language | TypeScript |
| Deployment | [Vercel](https://vercel.com/) |

## Project Structure

```
src/
├── app/
│   ├── page.tsx                          # Dashboard (course cards)
│   ├── landing/page.tsx                  # Judge demo guide (3-step walkthrough)
│   ├── admin/page.tsx                    # Canvas import control room
│   ├── courses/[courseId]/
│   │   ├── page.tsx                      # Course home
│   │   ├── assistant/page.tsx            # Study Assistant + Practice Quiz
│   │   └── [section]/page.tsx            # Dynamic section pages
│   ├── calendar/, inbox/, profile/       # LMS shell pages
│   ├── groups/, history/, help/          # Additional shell pages
│   └── api/
│       ├── courses/import/               # POST: trigger Canvas import (SSE)
│       ├── courses/list-canvas/          # GET: list Canvas courses
│       ├── courses/[id]/import-status/   # GET: import progress + file list
│       ├── courses/[id]/canvas-weeks/    # GET: preview Canvas modules
│       ├── files/[fileId]/reprocess/     # POST: reprocess a single file
│       ├── weeks/[weekId]/reprocess/     # POST: reprocess a whole week
│       ├── study/ask/                    # POST: streaming RAG Q&A
│       ├── study/quiz/                   # POST: generate practice quiz
│       ├── study/grade/                  # POST: LLM-grade short answer
│       ├── study/ingest/                 # POST: trigger in-memory ingestion
│       ├── study/courses/                # GET: list ingested courses
│       ├── study/diag/                   # GET: stuck-file diagnostics
│       ├── study/process-pending/        # POST: kick queue for stuck files
│       ├── study/cleanup-junk/           # POST: purge junk index entries
│       ├── analyse/                      # POST: extract document title
│       ├── chat/                         # POST: legacy chat endpoint
│       ├── upload/                       # POST: manual file upload
│       └── transcripts/                  # GET: transcript listing
├── components/
│   ├── StudySession.tsx                  # Ask + Quiz UI (client component)
│   ├── canvas-shell.tsx                  # LMS navigation shell
│   └── canvas/                           # Icon set, course top bar, modules list
└── lib/
    ├── canvas/
    │   ├── client.ts                     # Canvas REST client
    │   ├── import-course.ts              # Module → Supabase ingest
    │   ├── anonymise.ts                  # PII scrubbing for Canvas content
    │   └── types.ts
    ├── processing/
    │   ├── extract-text.ts               # Format-aware text extraction
    │   ├── process-file.ts               # File → chunks → embeddings
    │   └── summarise.ts                  # OpenAI summarisation
    ├── study/
    │   ├── ingest.ts                     # Legacy in-memory ingest pipeline
    │   ├── chunker.ts                    # Text → overlapping chunks
    │   ├── embeddings.ts                 # OpenAI embedding calls
    │   ├── retrieve.ts                   # Cosine-similarity retrieval
    │   ├── ask.ts                        # RAG answer generation
    │   ├── quiz.ts                       # Quiz generation
    │   ├── quiz-history-storage.ts       # localStorage quiz history
    │   ├── grade.ts                      # Short-answer grading
    │   ├── supabase-rag.ts               # Supabase pgvector store
    │   ├── store.ts                      # In-memory corpus fallback
    │   └── session-server.ts             # Assistant SSR data loader
    ├── sse.ts, sse-client.ts             # Server-Sent Events helpers
    ├── ai/provider.ts                    # OpenAI client with retry logic
    ├── course-import-lock.ts             # Per-course advisory lock
    ├── course-modules.ts                 # Module helpers
    ├── resolve-supabase-course-id.ts     # Resolve courses by id or Canvas id
    └── supabase-admin.ts                 # Supabase service-role client

supabase/
├── functions/
│   ├── _shared/{ai,canvas}.ts            # Shared edge logic
│   ├── ingest-canvas/                    # Edge function: kick a Canvas import
│   └── process-file/                     # Edge function: process a single file
└── migrations/                            # documents, vectors, locks, etc.
```

## Getting Started

### Prerequisites

- Node.js v18+
- A Canvas instance with a personal access token
- An OpenAI API key
- (Optional) A Supabase project for pgvector persistence

### Installation

```bash
npm install
```

### Environment variables

Create a `.env.local` file:

```env
# Canvas
CANVAS_BASE_URL=https://your-canvas-instance.edu
CANVAS_TOKEN=your_canvas_personal_access_token

# OpenAI
OPENAI_API_KEY=sk-...

# Supabase (optional — falls back to in-memory store without these)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

If you use Supabase, run the migrations under `supabase/migrations/` (via the Supabase CLI) and deploy the edge functions in `supabase/functions/`.

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the dashboard, or [http://localhost:3000/landing](http://localhost:3000/landing) for the guided three-step demo:

1. Open the featured course (Computer Graphics — fully ingested with real Canvas content).
2. Try the Study Assistant.
3. Watch the import pipeline at `/admin`.

## Deployment

Deploy to Vercel in one click. The repo includes a `vercel.json` that configures the Next.js framework preset.

1. Push to GitHub.
2. Import the repo in the Vercel dashboard.
3. Add the environment variables above.
4. Deploy.

## Known Limitations

- Indexes `.pdf` slides, Canvas pages, and assignment briefs only. `.pptx`, `.docx`, and `.zip` are not processed.
- Image-only PDFs (no extractable text) are skipped.
- The assistant only sees the top-ranking retrieved chunks, so very broad cross-week comparisons may miss material.
- Quiz history is local to the browser (no spaced-repetition memory across devices).
- Canvas authentication uses a personal token — production would use Canvas OAuth 2.
