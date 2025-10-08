// app/api/math-problem/solution/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { z } from 'zod'
import { supabase } from '@/lib/supabaseClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MODEL = process.env.GOOGLE_MODEL || 'gemini-2.0-flash'

const Body = z.object({
  session_id: z.string().uuid()
})

const StepsSchema = z.object({
  steps: z.array(z.string().min(1)).min(3).max(15)
})

function extractJsonSnippet(text: string): string {
  const fenced = text.match(/```json([\s\S]*?)```/i)
  if (fenced && fenced[1]) return fenced[1]
  const braces = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
  return braces ? braces[0] : text
}

function sanitizeToStrictJson(text: string): string {
  let s = extractJsonSnippet(text)
  s = s.replace(/```json|```/gi, '')
  s = s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
  s = s.replace(/\r?\n+/g, ' ')
  return s.trim()
}

const MAX_RETRIES = 2
const RETRY_BASE_DELAY = 200

async function backoff(n: number) {
  return new Promise((r) => setTimeout(r, RETRY_BASE_DELAY * n))
}

async function fetchSession(session_id: string) {
  let lastErr: any = null
  for (let i = 0; i <= MAX_RETRIES; i++) {
    const { data, error } = await supabase
      .from('math_problem_sessions')
      .select('id, problem_text, difficulty, problem_type, revealed_at')
      .eq('id', session_id)
      .single()
    if (!error) return data
    lastErr = error
    if (i < MAX_RETRIES) await backoff(i + 1)
  }
  throw lastErr ?? new Error('session_fetch_failed')
}

async function fetchExistingSolution(session_id: string) {
  const { data } = await supabase
    .from('math_problem_solutions')
    .select('id, steps')
    .eq('session_id', session_id)
    .maybeSingle()
  return data ?? null
}

async function saveSolution(session_id: string, steps: string[]) {
  let lastErr: any = null
  for (let i = 0; i <= MAX_RETRIES; i++) {
    const { data, error } = await supabase
      .from('math_problem_solutions')
      .insert({ session_id, steps })
      .select('id, steps')
      .single()
    if (!error) return data
    lastErr = error
    if (String(error.message || '').toLowerCase().includes('duplicate') || String(error.code || '').includes('23505')) {
      const { data: retry } = await supabase
        .from('math_problem_solutions')
        .select('id, steps')
        .eq('session_id', session_id)
        .maybeSingle()
      if (retry?.steps) return retry
    }
    if (i < MAX_RETRIES) await backoff(i + 1)
  }
  throw lastErr ?? new Error('solution_save_failed')
}

async function markRevealedIfNeeded(session_id: string, alreadyRevealed: boolean) {
  if (alreadyRevealed) return
  const { error } = await supabase
    .from('math_problem_sessions')
    .update({ revealed_at: new Date().toISOString() })
    .eq('id', session_id)
  if (error) throw error
}

function finalStepIsValid(steps: string[]) {
  const last = steps[steps.length - 1] ?? ''
  const m = last.match(/^final\s*answer\s*:\s*(-?\d+(?:\.\d+)?)$/i)
  if (!m) return false
  const numStr = m[1]
  if (/^-?\d+$/.test(numStr)) return true
  if (/^-?\d+\.\d{2}$/.test(numStr)) return true
  return false
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Missing GOOGLE_API_KEY' }, { status: 500 })

    const { session_id } = Body.parse(await req.json())

    const [session, existing] = await Promise.all([
      fetchSession(session_id),
      fetchExistingSolution(session_id)
    ])

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
    }

    if (existing?.steps) {
      await markRevealedIfNeeded(session_id, !!session.revealed_at)
      return NextResponse.json({ steps: existing.steps }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: MODEL })

    const prompt = `
      You are a friendly Primary 5 (Grade 5) teacher. Provide a short step-by-step solution for the problem below using clear, simple steps and ending with a single numeric final answer.

      Problem:
      ${session.problem_text}

      OUTPUT REQUIREMENTS (STRICT):
      - Return JSON only. No backticks, no code fences, no extra text.
      - Schema exactly: {"steps": ["Step 1 ...", "Step 2 ...", "...", "Final answer: <number>"]}
      - "steps" must be an array of 3–15 short strings (no markdown).

      CONTENT RULES:
      - DO NOT USE LATEX.
      - If any quantities are in fraction form, include one step showing both forms, e.g. "Convert: 3/4 = 0.75".
      - When converting to decimal, use round half-up to 2 decimal places (e.g., 1.245 → 1.25).
      - Do not reveal multiple possible answers. Choose one correct result.
      - Do not repeat the full problem text in the steps.
      - Keep each step short and actionable (<=160 characters).

      FINAL STEP:
      - The last step must be exactly "Final answer: <number>" with no extra words.
      - If the result is an integer, output it without decimals (e.g., 15).
      - Otherwise output exactly two decimal places (e.g., 12.50), using round half-up.
      - Do not include units or words after the number.

      Return only the JSON object described above.
    `

    const resp = await model.generateContent(prompt)
    const raw = resp.response.text().trim()
    const jsonText = sanitizeToStrictJson(raw)

    let parsed: unknown
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON from model', raw }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
    }

    const safe = StepsSchema.safeParse(parsed)
    if (!safe.success) {
      return NextResponse.json({ error: 'AI JSON invalid', issues: safe.error.format(), raw }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
    }

    const steps = safe.data.steps
    if (!finalStepIsValid(steps)) {
      return NextResponse.json({ error: 'Final step is not in the required "Final answer: <number>" format' }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
    }

    const saved = await saveSolution(session_id, steps)
    await markRevealedIfNeeded(session_id, !!session.revealed_at)

    return NextResponse.json({ steps: saved.steps }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return NextResponse.json({ error: 'Bad request', issues: e.issues }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    }
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
