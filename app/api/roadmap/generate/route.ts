import { NextRequest, NextResponse } from 'next/server';
import { generateRoadmap } from '@/lib/roadmap-generator';
import type { GenerateRequest, GenerateResponse, ErrorResponse, Level } from '@/types';

// In-memory rate limiting. Resets when the server restarts.
// Structure: IP -> { count, resetAt }
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const ANON_LIMIT_PER_DAY = 2;
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
        error: 'Rate limit exceeded. Maximum 2 roadmaps per day for anonymous users.',
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

    // Start the pipeline. This creates the roadmap record and kicks off generation.
    // The function returns the slug immediately after creating the record.
    // The pipeline continues running in the same request.
    const slug = await generateRoadmap(topic, level, language);

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
