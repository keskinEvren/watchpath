import type { Metadata } from 'next';
import RoadmapPageClient from './RoadmapPageClient';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  // Attempt to fetch roadmap title for metadata
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
    const res = await fetch(`${base}/api/roadmap/${slug}`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      return {
        title: `${data.roadmap?.topic ?? slug} - WatchPath`,
        description: `${data.roadmap?.topic ?? slug} konusunda AI destekli YouTube öğrenme yol haritası.`,
      };
    }
  } catch {
    // fallback below
  }
  return {
    title: `${slug} - WatchPath`,
  };
}

export default async function RoadmapPage({ params }: PageProps) {
  const { slug } = await params;
  return <RoadmapPageClient slug={slug} />;
}
