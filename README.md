# Vibeathon

An AI-powered education platform built for the ANU Hackathon. Vibeathon reimagines the Canvas LMS experience by layering a RAG-driven Study Assistant, AI-graded practice quizzes, and an admin import pipeline on top of a faithful Canvas shell UI.

## Features

### Canvas Shell UI
A pixel-faithful replica of the Canvas LMS interface built with Tailwind CSS. Includes a course dashboard, calendar, inbox, groups, profile, and per-course section pages (Announcements, Assignments, Quizzes, Modules, etc.).

### Admin Import Control Room (`/admin`)
Select any Canvas course, preview its numbered teaching weeks and supporting modules, then trigger a selective or full import. A live status bar polls every 3 seconds and shows ingestion progress (queued → processing → ready). Legacy manual file upload is also available.

### RAG-powered Study Assistant (`/courses/[id]/assistant`)
Ask questions grounded in the course's imported materials. Answers stream chunk-by-chunk and include inline citations `[1]`, `[2]` linking back to the original Canvas pages, PDFs, or assignment briefs. Conversation history is maintained within the session.

### Practice Quiz Generator
Generate 3–12 exam-style questions (multiple choice or short answer) on any topic within the course. Multiple-choice answers are checked client-side; short answers are graded by a second OpenAI call that returns a 0–1 score and written feedback. Each question cites its source documents, and a "Ask follow-up →" button pre-fills the chat with the question context.

### Canvas Content Ingestion Pipeline
Fetches all modules from Canvas and processes:
- **Canvas Pages** — HTML body extracted to plain text
- **PDF files** — downloaded and parsed with `pdf-parse` (up to 60 PDFs, 25 MB each)
- **Assignment briefs** — HTML description stripped to text
- Image-only PDFs, `.pptx`, `.docx`, and `.zip` files are skipped with a logged reason

Extracted text is chunked, embedded with `text-embedding-3-small`, and stored in Supabase (with an in-memory fallback when Supabase is not configured).

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | [Next.js 14](https://nextjs.org/) App Router (React 18) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| Database & Storage | [Supabase](https://supabase.com/) |
| AI — chat & grading | [OpenAI](https://openai.com/) (`gpt-4o-mini` via streaming) |
| AI — embeddings | OpenAI `text-embedding-3-small` |
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
│   ├── admin/page.tsx                    # Canvas import control room
│   ├── courses/[courseId]/
│   │   ├── page.tsx                      # Course home
│   │   ├── assistant/page.tsx            # Study Assistant + Practice Quiz
│   │   ├── materials/page.tsx            # Materials list
│   │   └── [section]/page.tsx            # Dynamic section pages
│   ├── calendar/, inbox/, profile/       # LMS shell pages
│   ├── groups/, history/, help/          # Additional shell pages
│   └── api/
│       ├── courses/import/               # POST: trigger Canvas import
│       ├── courses/list-canvas/          # GET: list Canvas courses
│       ├── courses/[id]/import-status/   # GET: import progress + file list
│       ├── courses/[id]/canvas-weeks/    # GET: preview Canvas modules
│       ├── study/ask/                    # POST: streaming RAG Q&A
│       ├── study/quiz/                   # POST: generate practice quiz
│       ├── study/grade/                  # POST: LLM-grade short answer
│       ├── study/ingest/                 # POST: trigger in-memory ingestion
│       ├── study/courses/               # GET: list ingested courses
│       ├── analyse/                      # POST: extract document title
│       ├── upload/                       # POST: manual file upload
│       ├── files/[fileId]/reprocess/     # POST: reprocess a file
│       └── weeks/[weekId]/reprocess/     # POST: reprocess a week
├── components/
│   ├── StudySession.tsx                  # Ask + Quiz UI (client component)
│   ├── canvas-shell.tsx                  # LMS navigation shell
│   └── canvas/                           # Icon set, course top bar, modules list
└── lib/
    ├── canvas/                           # Canvas API client, import-course logic
    ├── study/
    │   ├── ingest.ts                     # Module → document pipeline
    │   ├── chunker.ts                    # Text → overlapping chunks
    │   ├── embeddings.ts                 # OpenAI embedding calls
    │   ├── retrieve.ts                   # Cosine-similarity retrieval
    │   ├── ask.ts                        # RAG answer generation
    │   ├── quiz.ts                       # Quiz generation
    │   ├── grade.ts                      # Short-answer grading
    │   ├── supabase-rag.ts               # Supabase vector store
    │   └── store.ts                      # In-memory corpus fallback
    ├── ai/provider.ts                    # OpenAI client with retry logic
    └── supabase-admin.ts                 # Supabase service-role client
```

## Getting Started

### Prerequisites

- Node.js v18+
- A Canvas instance with a personal access token
- An OpenAI API key
- (Optional) A Supabase project for persistence

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

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Navigate to `/admin` to import a Canvas course, then visit `/courses/[courseId]/assistant` to use the Study Assistant.

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
- No spaced-repetition memory across sessions.
- Canvas authentication uses a personal token — production would use Canvas OAuth 2.
