import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';

// Scanning, grading and graded-price estimates run on Claude through the "scan" server function,
// which keeps the API key on the server. Each call needs you to be signed in.

export type Identified = {
  found: boolean;
  name: string;
  set_name: string;
  number: string;
  year: string;
  rarity: string;
  variant: string;
  language: string;
  confidence: 'high' | 'medium' | 'low';
  notes: string;
  raw_aud: { low: number | null; mid: number | null; high: number | null };
  graded_aud: { psa8: number | null; psa9: number | null; psa10: number | null };
};

export type GradedPrices = { psa8: number | null; psa9: number | null; psa10: number | null; source: 'estimate'; at: number };

export type Sub = { score: number; note: string };
export type Grade = {
  most_likely: number;
  low: number;
  high: number;
  centering: Sub & { front: string };
  corners: Sub;
  edges: Sub;
  surface: Sub;
  photo_quality: 'good' | 'fair' | 'poor';
  worth_grading: boolean;
  advice: string;
  at?: number;
};

export type CardContext = { name: string; set_name: string; number: string; variant?: string; raw_mid_aud?: number | null; graded?: { psa8: number | null; psa9: number | null; psa10: number | null } | null };

// Long side about 1500 px: enough detail for grading, small enough to upload quickly.
export async function prepPhoto(uri: string, width: number, height: number): Promise<string> {
  const portrait = height >= width;
  const resize = portrait ? { height: Math.min(height || 1500, 1500) } : { width: Math.min(width || 1500, 1500) };
  const out = await manipulateAsync(uri, [{ resize }], { compress: 0.85, format: SaveFormat.JPEG, base64: true });
  if (!out.base64) throw new Error('Could not read that photo.');
  return out.base64;
}

async function call<T>(body: object): Promise<T> {
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) throw new Error('Sign in on the Account tab to scan cards.');
  const { data, error } = await supabase.functions.invoke('scan', { body });
  if (error) {
    let msg = 'Could not reach the scanner. Check your connection and try again.';
    if (error instanceof FunctionsHttpError) {
      try { const j = await error.context.json(); if (j?.error) msg = j.error; } catch {}
    }
    throw new Error(msg);
  }
  return data as T;
}

export const identify = (front: string, back?: string | null) => call<Identified>({ mode: 'identify', front, back: back ?? undefined });
export const gradeCard = (front: string, back: string | null, card: CardContext | null) =>
  call<Grade>({ mode: 'grade', front, back: back ?? undefined, card: card ?? undefined });
export const estimateGraded = (card: CardContext) =>
  call<{ graded_aud: { psa8: number | null; psa9: number | null; psa10: number | null }; notes: string }>({ mode: 'estimate', card });

// PSA format: whole grades as "9", half grades as "8.5".
export const fmtGrade = (n: number | null | undefined) =>
  n == null || !isFinite(n) ? '–' : Number.isInteger(n) ? String(n) : (Math.round(n * 2) / 2).toFixed(1);
export const gradeRange = (g: Grade | null | undefined) => (g ? fmtGrade(g.most_likely) : '–');
