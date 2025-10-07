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

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Missing GOOGLE_API_KEY' }, { status: 500 })

    const { session_id } = Body.parse(await req.json())

    const { data: session, error: sErr } = await supabase
      .from('math_problem_sessions')
      .select('id, problem_text, correct_answer, difficulty, problem_type, revealed_at')
      .eq('id', session_id)
      .single()

    if (sErr || !session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    const { data: existing } = await supabase
      .from('math_problem_solutions')
      .select('id, steps')
      .eq('session_id', session_id)
      .maybeSingle()

    if (existing?.steps) {
      if (!session.revealed_at) {
        const { error: updErrExisting } = await supabase
          .from('math_problem_sessions')
          .update({ revealed_at: new Date().toISOString() })
          .eq('id', session_id)
        if (updErrExisting) return NextResponse.json({ error: updErrExisting.message }, { status: 500 })
      }
      return NextResponse.json({ steps: existing.steps })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: MODEL })

    const prompt = `
      You are a friendly Primary 5 teacher. Provide a short step-by-step solution for the following problem with clear, simple steps and the final answer at the end.

      Problem:
      ${session.problem_text}

      Output JSON only:
      {"steps": ["Step 1 ...", "Step 2 ...", "...", "Final answer: <number>"]}
      Keep it concise (3-8 steps). Avoid extra commentary outside JSON.
      `

    const resp = await model.generateContent(prompt)
    const raw = resp.response.text().trim()
    const jsonText = sanitizeToStrictJson(raw)

    const parsed = JSON.parse(jsonText)
    const steps = Array.isArray(parsed.steps) ? parsed.steps : []

    if (!steps.length) {
      return NextResponse.json({ error: 'AI did not return steps' }, { status: 502 })
    }

    if (!session.revealed_at) {
      const { error: updErr } = await supabase
        .from('math_problem_sessions')
        .update({ revealed_at: new Date().toISOString() })
        .eq('id', session_id)
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    const { data: saved, error: iErr } = await supabase
      .from('math_problem_solutions')
      .insert({
        session_id,
        steps
      })
      .select('id, steps')
      .single()

    if (iErr) {
      const { data: retry } = await supabase
        .from('math_problem_solutions')
        .select('id, steps')
        .eq('session_id', session_id)
        .maybeSingle()
      if (retry?.steps) return NextResponse.json({ steps: retry.steps })
      return NextResponse.json({ error: iErr.message }, { status: 500 })
    }

    return NextResponse.json({ steps: saved.steps })
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return NextResponse.json({ error: 'Bad request', issues: e.issues }, { status: 400 })
    }
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 })
  }
}
