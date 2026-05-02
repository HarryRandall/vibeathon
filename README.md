# Vibeathon

A full-stack AI-empowered education platform built for the ANU Hackathon. Vibeathon reimagines the Canvas LMS experience by integrating intelligent study pipelines, AI assistants, and robust internal tooling. It features a modern shell UI that mirrors popular LMS systems while automatically generating study insights using OpenAI.

## Features

- **Intelligent Canvas Integration**: Seamlessly pulls from Canvas APIs, with built-in fallback to dummy data for development.
- **AI Study Pipeline & Ingestion**: Automated ingestion of course materials with robust OpenAI connection handling (retries, timeouts, and error handling).
- **Responsive LMS Shell UI**: Courses, calendar, inbox, and profile dashboard views built with Tailwind CSS.
- **Real-Time Streaming Chat**: Integrated AI assistant to tutor students chunk-by-chunk.
- **Robust Backend Infrastructure**: Next.js 14 App Router APIs paired with Supabase for data persistence and Vercel for fast deployments.

## Tech Stack

- **Framework:** [Next.js 14](https://nextjs.org/) (React 18)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Database & Auth:** [Supabase](https://supabase.com/)
- **AI Provider:** [OpenAI API](https://openai.com/)
- **Language:** TypeScript

## Getting Started

### Prerequisites

Ensure you have Node.js (v18+) installed on your machine.

### Installation

1. Install the dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables locally in a `.env.local` file. You will need:
   - Supabase keys (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - OpenAI API key (`OPENAI_API_KEY`)
   - Canvas API credentials (if applicable)

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to interact with the app.

## Deployment

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new). 
This project includes a `vercel.json` configuration for seamless deployment.

1. Push your code to a GitHub repository.
2. Import the project into Vercel.
3. Add your environment variables in the Vercel dashboard.
4. Deploy!

## Project Structure

- `src/app/courses/`, `calendar/`, `inbox/`: Canvas-like UI pages and routing.
- `src/app/api/`: Backend endpoints, including AI chat and Canvas study data ingestion pipelines.
- `src/lib/study/` & `src/lib/ai/`: Core logic for OpenAI study material processing and chat retries.
- `src/lib/canvas/`: Canvas API integration and helper utilities.
- `src/lib/supabase/`: Supabase client definitions for backend and frontend data fetching.
