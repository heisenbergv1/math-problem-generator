// lib/supabaseClient.ts

import { createClient } from '@supabase/supabase-js'

export type Database = {
  public: {
    Tables: {
      math_problem_sessions: {
        Row: {
          id: string
          created_at: string
          problem_text: string
          correct_answer: number
          difficulty: 'Easy' | 'Medium' | 'Hard'
          problem_type: 'addition' | 'subtraction' | 'multiplication' | 'division' | 'mixed'
        }
        Insert: {
          id?: string
          created_at?: string
          problem_text: string
          correct_answer: number
          difficulty?: 'Easy' | 'Medium' | 'Hard'
          problem_type?: 'addition' | 'subtraction' | 'multiplication' | 'division' | 'mixed'
        }
        Update: {
          id?: string
          created_at?: string
          problem_text?: string
          correct_answer?: number
          difficulty?: 'Easy' | 'Medium' | 'Hard'
          problem_type?: 'addition' | 'subtraction' | 'multiplication' | 'division' | 'mixed'
        }
      }
      math_problem_submissions: {
        Row: {
          id: string
          session_id: string
          created_at: string
          user_answer: number
          is_correct: boolean
          feedback_text: string
        }
        Insert: {
          id?: string
          session_id: string
          created_at?: string
          user_answer: number
          is_correct: boolean
          feedback_text: string
        }
        Update: {
          id?: string
          session_id?: string
          created_at?: string
          user_answer?: number
          is_correct?: boolean
          feedback_text?: string
        }
      }
      math_problem_hints: {
        Row: {
          id: string
          session_id: string
          hint_text: string
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          hint_text: string
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          hint_text?: string
          created_at?: string
        }
      }
      math_problem_solutions: {
        Row: {
          id: string
          session_id: string
          steps: any
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          steps: any
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          steps?: any
          created_at?: string
        }
      }
      score_summaries: {
        Row: {
          client_id: string
          total_attempts: number
          correct_count: number
          current_streak: number
          best_streak: number
          points: number
          last_updated: string
        }
        Insert: {
          client_id: string
          total_attempts?: number
          correct_count?: number
          current_streak?: number
          best_streak?: number
          points?: number
          last_updated?: string
        }
        Update: {
          client_id?: string
          total_attempts?: number
          correct_count?: number
          current_streak?: number
          best_streak?: number
          points?: number
          last_updated?: string
        }
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
