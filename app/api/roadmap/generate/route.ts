import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { createRoadmapRecord, runFullPipeline } from '@/lib/roadmap-generator';
import type { GenerateRequest, GenerateResponse, ErrorResponse, Level } from '@/types';

// Vercel serverless: extend timeout to 60s (Hobby plan max)
export const maxDuration = 60;

// In-memory rate limiting. Resets when the server restarts.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const ANON_LIMIT_PER_DAY = 10;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + MS_PER_DAY });
    return true;
  }

  if (entry.count >= ANON_LIMIT_PER_DAY) {
    return false;
  }

  entry.count++;
  return true;
}

const VALID_LEVELS: Level[] = ['beginner', 'intermediate', 'advanced'];

export async function POST(request: NextRequest) {
  try {
    // Rate limiting by IP
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown';

    if (!checkRateLimit(ip)) {
      const res: ErrorResponse = {
        error: 'Günlük limit aşıldı. Anonim kullanıcılar günde en fazla 10 yol haritası oluşturabilir.',
        code: 'RATE_LIMIT',
      };
      return NextResponse.json(res, { status: 429 });
    }

    // Parse and validate request body
    const body = (await request.json()) as Partial<GenerateRequest>;

    if (!body.topic || typeof body.topic !== 'string' || body.topic.trim().length === 0) {
      const res: ErrorResponse = { error: 'topic is required', code: 'VALIDATION' };
      return NextResponse.json(res, { status: 400 });
    }

    const topic = body.topic.trim().slice(0, 200);
    const level: Level =
      body.level && VALID_LEVELS.includes(body.level) ? body.level : 'beginner';
    const language = body.language ?? 'tr';
    const answers = body.answers ?? {};

    // Step 1: Create roadmap record (fast DB insert)
    const slug = await createRoadmapRecord(topic, level);

    // Step 2: Run pipeline in background using Next.js after()
    // after() uses waitUntil on Vercel - keeps function alive after response
    after(async () => {
      try {
        await runFullPipeline(slug, topic, level, language, answers);
      } catch (err) {
        console.error('[api/generate] Background pipeline error:', err);
      }
    });

    // Step 3: Return slug immediately (client polls for status)
    const response: GenerateResponse = {
      slug,
      status: 'generating',
    };

    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    console.error('[api/generate] Error:', err);
    const message =
      err instanceof Error ? err.message : 'Internal server error';
    const res: ErrorResponse = { error: message };
    return NextResponse.json(res, { status: 500 });
  }
}
