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

## Additional Features (Optional)

If you have time, consider adding:

- [x] Difficulty levels (Easy/Medium/Hard)
- [x] Problem history view
- [x] Score tracking
- [x] Different problem types (addition, subtraction, multiplication, division)
- [x] Hints system
- [x] Step-by-step solution explanations

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

   GOOGLE_MODEL=gemini-2.0-flash
   ```

## Implementation Notes

*This section is for any important notes about the implementation, design decisions, challenges faced, or features particularly proud of.*

### Implementation:

Here are implementation notes, design decisions, challenges, and things we’re proud of (with a focus on prompt tuning and reliability):

1. **Prompt tuning for consistent, gradable outputs**

   * Tightened the generation and solution prompts to enforce: JSON-only, explicit schema, and a final step formatted exactly as `Final answer: <number>`.
   * Clarified “Work steps” vs “Final step” counts to avoid ambiguity that caused the model to over-generate steps.
   * Added numeric formatting rules (integers vs two-decimals) and server-side validation to catch drift.
   * Outcome: fewer malformed responses; easier to parse, save, and grade.

   **File:** `app/api/math-problem/route.ts`

   ```ts
   const prompt = `
   ...
   STEPS RULES:
   - "steps" is an array of short strings (no markdown).
   - Structure = [work steps..., final step]; the FINAL step MUST be exactly: "Final answer: <number>".
   - Work steps length target by difficulty as specified below.
   ...
   MEDIUM:
   - STRICTLY FOLLOW THE OPERATION: ${problem_type}
   - Work steps: 3–6.
   ...
   HARD:
   - STRICTLY FOLLOW THE OPERATION: ${problem_type}
   - Work steps: 7–15
   ...
   `;
   ```

2. **Fail-safe model handling and graceful degradation**

   * Wrapped all model calls with short timeouts and bounded retries; added minimal backoff.
   * On failure, return concise, student-friendly fallback messages so the UI never silently stalls.
   * Kept error messages user-safe while still surfacing enough detail server-side for ops.

   **File:** `app/api/math-problem/route.ts`

   ```ts
   const GEN_TIMEOUT_MS = 8000;
   const GEN_MAX_RETRIES = 2;

   function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
   return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('generation_timeout')), ms);
      p.then(v => { clearTimeout(t); resolve(v); }).catch(e => { clearTimeout(t); reject(e); });
   });
   }

   async function generateWithRetry(gen: () => Promise<string>): Promise<string> {
   let lastErr: any = null;
   for (let i = 0; i <= GEN_MAX_RETRIES; i++) {
      try { return await gen(); } catch (e) { lastErr = e; }
   }
   throw lastErr ?? new Error('generation_failed');
   }
   ```

3. **Deterministic persistence & idempotency**

   * Save-first-or-reuse patterns for solutions and hints to prevent duplicates on fast clicks or network retries.
   * Parallelized independent queries (e.g., session lookup + hint count + history list), and added retry-on-23505 logic where appropriate.
   * Result: fewer race conditions and no “ghost” records.

   **File:** `app/api/math-problem/solution/route.ts`

   ```ts
   async function saveSolution(session_id: string, steps: string[]) {
   let lastErr: any = null;
   for (let i = 0; i <= MAX_RETRIES; i++) {
      const { data, error } = await supabase
         .from('math_problem_solutions')
         .insert({ session_id, steps })
         .select('id, steps')
         .single();
      if (!error) return data;
      lastErr = error;
      if (String(error.message || '').toLowerCase().includes('duplicate') || String(error.code || '').includes('23505')) {
         const { data: retry } = await supabase
         .from('math_problem_solutions')
         .select('id, steps')
         .eq('session_id', session_id)
         .maybeSingle();
         if (retry?.steps) return retry;
      }
      if (i < MAX_RETRIES) await new Promise(r => setTimeout(r, RETRY_BASE_DELAY * (i + 1)));
   }
   throw lastErr ?? new Error('solution_save_failed');
   }
   ```

4. **Strict output validation before saving**

   * Validate JSON structure (zod), final-step regex, and number formatting.
   * If the last step is slightly off but recoverable (e.g., wrong decimal precision), we normalize before persisting to keep the DB coherent.

   **File:** `app/api/math-problem/solution/route.ts`

   ```ts
   function finalStepIsValid(steps: string[]) {
   const last = steps[steps.length - 1] ?? '';
   return /^final\s*answer\s*:\s*-?\d+(?:\.\d{2})?$/i.test(last);
   }
   ```

5. **User experience under imperfect networks**

   * Added optimistic/explicit loading states and small skeletons for long-running actions.
   * Replaced silent `console.warn` patterns with user-visible error toasts/blocks.
   * Disabled conflicting buttons during in-flight actions; added AbortController to cancel stale requests on problem changes/unmount.

   **File:** `components/ProblemDisplay.tsx`

   ```tsx
   {isStepsLoading && (
   <div className="mt-2 mb-4 space-y-2" aria-live="polite">
      <div className="h-3 w-2/3 bg-emerald-100 animate-pulse rounded" />
      <div className="h-3 w-3/4 bg-emerald-100 animate-pulse rounded" />
      <div className="h-3 w-1/2 bg-emerald-100 animate-pulse rounded" />
   </div>
   )}
   ```

6. **State correctness & “Clear history” reliability**

   * Fixed client state not clearing by plumbing an `onCleared()` callback from the modal back to the page to immediately empty the list, then `router.refresh()` to sync server/client.
   * Avoids the confusing moment where the DB is cleared but the UI still shows old rows.

   **File:** `app/history/page.tsx`

   ```tsx
   const handleCleared = useCallback(() => {
   setItems([]);
   setErrorMessage(null);
   }, []);

   <Suspense fallback={null}>
   <ClearHistoryButton onCleared={handleCleared} />
   </Suspense>
   ```

7. **Cache discipline for correctness**

   * Set `Cache-Control: no-store` on API responses that are personalized, rapidly changing, or mutation-related (score, feedback, hints, solutions).
   * Prevents stale UI (especially under CDNs or shared caches) and ensures students always see the latest score/progress.

   **File:** `app/api/score/route.ts`

   ```ts
   return NextResponse.json(
   { score: null },
   { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
   );
   ```

8. **Performance through minimal re-renders**

   * Wrapped presentational components in `React.memo`, used `useMemo`/`useCallback` for stable props, and avoided expensive work in render paths.
   * Reduced unnecessary re-fetches and serialized awaits; pushed parallel fetches where safe.

   **File:** `components/ScoreDisplay.tsx`

   ```tsx
   export const ScoreDisplay = React.memo(function ScoreDisplay({ score }: { score: Score }) {
   const safe = useMemo(() => ({
      points: score?.points ?? 0,
      accuracy: Number.isFinite(score?.accuracy) ? score!.accuracy : 0,
      current_streak: score?.current_streak ?? 0,
      best_streak: score?.best_streak ?? 0
   }), [score]);

   return (
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-live="polite">
         {/* cards */}
      </div>
   );
   });
   ```

9. **Consistency across endpoints**

   * Normalized error shapes and headers (including `no-store`).
   * Centralized small retry/backoff helpers per endpoint (not yet extracted globally to keep the patch small, but ready for a shared util).

10. **Security & privacy minded feedback**

   * Sanitized model feedback to avoid leaking exact answers when not intended and removed code fences/formatting artifacts.
   * Kept messages short, age-appropriate, and focused on next actionable step.

11. **Testability & observability**

   * Clear failure modes (400/404/409/5xx) make it straightforward to write integration tests.
   * Returned `raw` text only on validation errors to help diagnose prompt drift during QA without exposing it to students.

12. **Known trade-offs & future polish**

   * Current backoff is linear; a jittered exponential policy would further reduce thundering herd on transient 5xx/429.
   * Retry utility is duplicated across routes for now to keep changes minimal; extracting a tiny shared helper is a low-risk follow-up.
   * Additional content filters (e.g., stricter check for decimal precision) can be toggled if we see model regressions.

---