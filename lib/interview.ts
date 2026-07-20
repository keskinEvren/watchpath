// ============================================================
// WatchPath v2 - Interview Engine
// Generates topic-specific questions and builds user profiles
// ============================================================

import type { InterviewQuestion, UserProfile } from '@/types';
import { generateDynamicQuestions } from '@/lib/gemini';

/**
 * Generate interview questions for a given topic.
 * Returns 3 structured questions: level, goal, weakness.
 *
 * Uses Gemini for dynamic question generation, but falls back
 * to generic questions if the API call fails.
 */
export async function generateInterviewQuestions(
  topic: string,
): Promise<InterviewQuestion[]> {
  try {
    return await generateDynamicQuestions(topic);
  } catch (err) {
    console.warn('[interview] Failed to generate dynamic questions, using fallback:', err);
    return buildFallbackQuestions(topic);
  }
}

/**
 * Build a user profile from interview answers.
 * Extracts structured data from raw answer key-value pairs.
 */
export function buildProfileFromAnswers(
  topic: string,
  answers: Record<string, string>,
): UserProfile {
  // Extract level (0-1 scale)
  const levelAnswer = answers['level'] ?? answers['seviye'] ?? '';
  let level = 0.5;
  if (levelAnswer.includes('beginner') || levelAnswer.includes('sifir') || levelAnswer.includes('baslangic')) {
    level = 0.1;
  } else if (levelAnswer.includes('elementary') || levelAnswer.includes('temel')) {
    level = 0.3;
  } else if (levelAnswer.includes('intermediate') || levelAnswer.includes('orta')) {
    level = 0.5;
  } else if (levelAnswer.includes('advanced') || levelAnswer.includes('ileri')) {
    level = 0.8;
  } else if (levelAnswer.includes('expert') || levelAnswer.includes('uzman')) {
    level = 1.0;
  }

  // Extract goal
  const goal = answers['goal'] ?? answers['hedef'] ?? answers['amac'] ?? 'general';

  // Extract weakness
  const weakness = answers['weakness'] ?? answers['zayif'] ?? answers['zorlandigi'] ?? 'general';

  return {
    topic,
    level,
    goal,
    weakness,
    answers,
  };
}

/**
 * Generic fallback questions for any topic.
 */
function buildFallbackQuestions(topic: string): InterviewQuestion[] {
  return [
    {
      id: 'level',
      question: `${topic} konusunda şu anki seviyenizi nasıl tanımlarsınız?`,
      options: [
        { value: 'beginner', label: 'Sıfırdan başlıyorum' },
        { value: 'elementary', label: 'Temel bilgim var' },
        { value: 'intermediate', label: 'Orta seviye, derinleşmek istiyorum' },
        { value: 'advanced', label: 'İleri seviye, uzmanlaşmak istiyorum' },
      ],
    },
    {
      id: 'goal',
      question: `${topic} öğrenme amacınız nedir?`,
      options: [
        { value: 'career', label: 'Kariyer / iş için' },
        { value: 'hobby', label: 'Hobi / kişisel gelişim' },
        { value: 'project', label: 'Belirli bir projeyi tamamlamak' },
        { value: 'exam', label: 'Sınav / sertifika hazırlığı' },
      ],
    },
    {
      id: 'weakness',
      question: `${topic} konusunda en çok zorlandığınız alan hangisi?`,
      options: [
        { value: 'fundamentals', label: 'Temelleri anlamak' },
        { value: 'practice', label: 'Pratiğe dökmek' },
        { value: 'advanced-concepts', label: 'İleri konular' },
        { value: 'staying-consistent', label: 'Düzenli çalışmak / motivasyon' },
      ],
    },
  ];
}
