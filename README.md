# Math Problem Generator

## Overview

This is a starter kit for building an AI-powered math problem generator application. The goal is to create a standalone prototype that uses AI to generate math word problems suitable for Primary 5 students, saves the problems and user submissions to a database, and provides personalized feedback.

## Tech Stack

- **Frontend Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase
- **AI Integration**: Google Generative AI (Gemini)

## Setup Instructions

### 1. Clone the Repository

```bash
git clone git@github.com:heisenbergv1/math-problem-generator.git
cd math-problem-generator
```

### 2. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Go to Settings → API to find your:
   - Project URL (starts with `https://`)
   - Anon/Public Key

### 3. Set Up Database Tables

1. In your Supabase dashboard, go to SQL Editor
2. Copy and paste the contents of `database.sql`
3. Click "Run" to create the tables and policies

### 4. Get Google API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key for Gemini

### 5. Configure Environment Variables

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```
2. Edit `.env.local` and add your actual keys:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_actual_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_supabase_anon_key
   GOOGLE_API_KEY=your_actual_google_api_key
   ```

### 6. Install Dependencies

```bash
npm install
```

### 7. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## TODO

### 1. Implement Frontend Logic (`app/page.tsx`)

Complete the TODO sections in the main page component:

- **generateProblem**: Call your API route to generate a new math problem
- **submitAnswer**: Submit the user's answer and get feedback

### 2. Create Backend API Route (`app/api/math-problem/route.ts`)

Create a new API route that handles:

#### POST /api/math-problem (Generate Problem)
- Use Google's Gemini AI to generate a math word problem
- The AI should return JSON with:
  ```json
  {
    "problem_text": "A bakery sold 45 cupcakes...",
    "final_answer": 15
  }
  ```
- Save the problem to `math_problem_sessions` table
- Return the problem and session ID to the frontend

#### POST /api/math-problem/submit (Submit Answer)
- Receive the session ID and user's answer
- Check if the answer is correct
- Use AI to generate personalized feedback based on:
  - The original problem
  - The correct answer
  - The user's answer
  - Whether they got it right or wrong
- Save the submission to `math_problem_submissions` table
- Return the feedback and correctness to the frontend

### 3. Requirements Checklist

- [x] AI generates appropriate Primary 5 level math problems
- [x] Problems and answers are saved to Supabase
- [x] User submissions are saved with feedback
- [x] AI generates helpful, personalized feedback
- [x] UI is clean and mobile-responsive
- [x] Error handling for API failures
- [x] Loading states during API calls

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Go to [Vercel](https://vercel.com) and import your repository
3. Add your environment variables in Vercel's project settings
4. Deploy!

## Live Demo

2. **Live Demo URL**: https://math-problem-generator-pi.vercel.app/
3. **Supabase Credentials**:
   ```
   SUPABASE_URL: https://fyudwcsgploehkstpnpi.supabase.co
   SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5dWR3Y3NncGxvZWhrc3RwbnBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3NTYzNDAsImV4cCI6MjA3NTMzMjM0MH0.i6kW96zwi1e9CkF3PUHwTgaXMmuu_pX1hHbgQVTUAto
   ```

## Implementation Notes

*This section is for any important notes about the implementation, design decisions, challenges faced, or features particularly proud of.*

### Implementation:

- Two-column layout: fixed-height left `SettingsPanel` (`md:h-96 md:overflow-y-auto`) to align with the right pane without touching the panel code.
- Correct-answer feedback moved to a reusable, center modal (emerald theme, blur overlay, fade/bounce, Esc to close, a11y labels). Same modal on re-submit of solved problems.
- “Show Solution Steps” becomes a toggle that, once revealed, locks the session—user must generate a new problem. Enforced in UI and backend (`409 solution_revealed`).
- Co-located solution UI/state under `ProblemDisplay`; removed inner close button per spec.
- Backend hard guards: `409 already_solved` if a correct submission exists; consistent JSON errors.
- History API returns all attempts; History page shows collapsible attempts table, wider “When” column, shadows, empty/error states.
- Production-safe data fetching: absolute URL via `NEXT_PUBLIC_BASE_URL` and `cache: 'no-store'` where needed; fixes Vercel relative-fetch issues.
- Score updates preserved on submit; shared types (`Difficulty`, `ProblemType`) centralized in `@/lib/types`.
- Minimal, surgical changes; Tailwind for animations (plus tiny keyframe for modal “pop”); focus/hover states and spinners for UX polish.


## Additional Features (Optional)

If you have time, consider adding:

- [x] Difficulty levels (Easy/Medium/Hard)
- [x] Problem history view
- [x] Score tracking
- [x] Different problem types (addition, subtraction, multiplication, division)
- [x] Hints system
- [x] Step-by-step solution explanations

---