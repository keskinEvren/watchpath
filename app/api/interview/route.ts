import { NextRequest, NextResponse } from 'next/server';
import { generateInterviewQuestions } from '@/lib/interview';
import type { InterviewResponse, ErrorResponse } from '@/types';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const topic = body.topic?.trim();

    if (!topic || typeof topic !== 'string' || topic.length === 0) {
      const res: ErrorResponse = { error: 'topic is required', code: 'VALIDATION' };
      return NextResponse.json(res, { status: 400 });
    }

    const questions = await generateInterviewQuestions(topic.slice(0, 200));

    const response: InterviewResponse = { questions };
    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error('[api/interview] Error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    const res: ErrorResponse = { error: message };
    return NextResponse.json(res, { status: 500 });
  }
}
