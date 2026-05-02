# Vibeathon

A full-stack AI chat application built for the ANU Hackathon. Vibeathon features a clean, responsive interface with streaming AI responses and a robust backend powered by modern web technologies.

## Features

- **Real-Time Streaming AI Chat**: Experience fast, chunk-by-chunk response streaming.
- **Modern UI/UX**: Clean and responsive chat interface built with Tailwind CSS.
- **Full-Stack Next.js**: Utilizes Next.js 14 App Router for both frontend and backend API capabilities.
- **Backend Infrastructure**: Integrated with Supabase for data and state management.

## Tech Stack

- **Framework:** [Next.js 14](https://nextjs.org/) (React 18)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Database & Auth:** [Supabase](https://supabase.com/)
- **Language:** TypeScript

## Getting Started

### Prerequisites

Ensure you have Node.js (v18+) installed on your machine.

### Installation

1. Install the dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables locally (e.g., Supabase keys, AI API keys) in a `.env.local` file.

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

- `src/app/page.tsx`: Main chat interface and React state management.
- `src/app/api/chat/route.ts`: API endpoint for handling AI conversations and text streaming.
- `src/lib/supabase/`: Supabase client configuration for server and client sides.
