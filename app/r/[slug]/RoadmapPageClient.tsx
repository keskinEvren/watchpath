'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import type { RoadmapDetailResponse, RoadmapStatus } from '@/types';
import RoadmapCanvas from '@/components/roadmap/RoadmapCanvas';
import RoadmapProgressBar from '@/components/roadmap/RoadmapProgressBar';
import LoadingOverlay from '@/components/shared/LoadingOverlay';
import NavBar from '@/components/shared/NavBar';

interface Props {
  slug: string;
}

export default function RoadmapPageClient({ slug }: Props) {
  const [data, setData] = useState<RoadmapDetailResponse | null>(null);
  const [status, setStatus] = useState<RoadmapStatus | 'loading' | 'not_found'>('loading');
  const [uiStatus, setUiStatus] = useState<RoadmapStatus | 'loading' | 'not_found' | 'revealing'>('loading');
  const [revealedCount, setRevealedCount] = useState(0);
  const [skeletonRevealedCount, setSkeletonRevealedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const videoNodes = useMemo(() => {
    if (!data) return [];
    return data.nodes.filter((n) => n.node_type === 'video');
  }, [data]);

  const totalVideos = videoNodes.length;

  const totalAllNodes = useMemo(() => {
    if (!data) return 0;
    return data.nodes.length;
  }, [data]);

  const fetchRoadmap = useCallback(async () => {
    try {
      const res = await fetch(`/api/roadmap/${slug}`, { cache: 'no-store' });
      if (res.status === 404) {
        setStatus('not_found');
        setUiStatus('not_found');
        return 'not_found' as const;
      }
      if (!res.ok) {
        setStatus('failed');
        setUiStatus('failed');
        setError('Yol haritası yüklenirken bir hata oluştu.');
        return 'failed' as const;
      }
      const json: RoadmapDetailResponse = await res.json();
      setData(json);
      
      setStatus((prev) => {
        const nextStatus = json.roadmap.status;
        if (prev === 'tree_ready' && nextStatus === 'ready') {
          setUiStatus('revealing');
          setRevealedCount(0);
        } else if (prev !== 'tree_ready' || nextStatus !== 'ready') {
          setUiStatus(nextStatus);
        }
        return nextStatus;
      });
      return json.roadmap.status;
    } catch {
      setStatus('failed');
      setUiStatus('failed');
      setError('Sunucuya bağlanılamadı.');
      return 'failed' as const;
    }
  }, [slug]);

  // Initial fetch + polling
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    async function poll() {
      const result = await fetchRoadmap();
      if (cancelled) return;
      if (result === 'generating' || result === 'tree_ready') {
        interval = setInterval(async () => {
          if (cancelled) return;
          const s = await fetchRoadmap();
          if (s === 'ready' || s === 'failed' || s === 'not_found') {
            if (interval) {
              clearInterval(interval);
              interval = null;
            }
          }
        }, 3000); // Poll every 3 seconds for database updates
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [fetchRoadmap]);

  // Staggered skeleton reveal during tree_ready
  useEffect(() => {
    if (uiStatus !== 'tree_ready') return;
    if (skeletonRevealedCount >= totalAllNodes) return;

    const timer = setTimeout(() => {
      setSkeletonRevealedCount((prev) => prev + 1);
    }, 120); // fast enough to feel alive, slow enough to see each node
    return () => clearTimeout(timer);
  }, [uiStatus, skeletonRevealedCount, totalAllNodes]);

  // Staggered video reveal effect
  useEffect(() => {
    if (uiStatus !== 'revealing') return;

    if (revealedCount < totalVideos) {
      const timer = setTimeout(() => {
        setRevealedCount((prev) => prev + 1);
      }, 800); // slower reveal so users watch each video pop in
      return () => clearTimeout(timer);
    } else {
      setUiStatus('ready');
    }
  }, [uiStatus, revealedCount, totalVideos]);

  // --- Loading / generating ---
  if (status === 'loading' || status === 'generating') {
    return <LoadingOverlay status="generating" />;
  }

  // --- Not found ---
  if (status === 'not_found') {
    return (
      <div style={overlayStyle}>
        <div style={errorContainerStyle}>
          <span style={{ fontSize: 64 }}>🔍</span>
          <h2 style={errorHeadingStyle}>Yol haritası bulunamadı</h2>
          <p style={errorBodyStyle}>
            Bu bağlantı geçersiz veya yol haritası silinmiş olabilir.
          </p>
          <a href="/" style={ctaBtnStyle}>
            Ana Sayfaya Dön
          </a>
        </div>
      </div>
    );
  }

  // --- Error / failed ---
  if (status === 'failed' || !data) {
    return (
      <div style={overlayStyle}>
        <div style={errorContainerStyle}>
          <span style={{ fontSize: 64 }}>⚠️</span>
          <h2 style={errorHeadingStyle}>Bir şeyler ters gitti</h2>
          <p style={errorBodyStyle}>
            {error ?? 'Yol haritası oluşturulurken bir hata oluştu.'}
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <a href="/" style={ctaBtnStyle}>
              Yeni Arama Yap
            </a>
            <button
              onClick={() => {
                setStatus('loading');
                setError(null);
                fetchRoadmap();
              }}
              style={{ ...ctaBtnStyle, background: '#57534e' }}
            >
              Tekrar Kontrol Et
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Ready / tree_ready ---
  return (
    <>
      <NavBar />
      <RoadmapProgressBar
        status={uiStatus}
        revealedCount={revealedCount}
        totalVideos={totalVideos}
      />
      <RoadmapCanvas
        nodes={data.nodes}
        edges={data.roadmap.edges_data}
        videos={data.videos}
        topic={data.roadmap.topic}
        level={data.roadmap.level}
        status={uiStatus}
        revealedCount={revealedCount}
        skeletonRevealedCount={skeletonRevealedCount}
        slug={slug}
      />
    </>
  );
}

// ---------- Inline styles (no CSS module needed for loading/error states) ----------

const overlayStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100vh',
  background: '#f7f7f3',
};

const errorContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 12,
  textAlign: 'center',
  maxWidth: 400,
  padding: 24,
};

const errorHeadingStyle: React.CSSProperties = {
  fontFamily: "'DM Sans', system-ui, sans-serif",
  fontSize: 20,
  fontWeight: 500,
  color: '#1c1917',
};

const errorBodyStyle: React.CSSProperties = {
  fontFamily: "'DM Sans', system-ui, sans-serif",
  fontSize: 15,
  color: '#57534e',
  lineHeight: 1.5,
};

const ctaBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: "'DM Sans', system-ui, sans-serif",
  fontSize: 15,
  fontWeight: 500,
  color: '#ffffff',
  background: '#4d7c0f',
  padding: '10px 24px',
  borderRadius: 9999,
  border: 'none',
  cursor: 'pointer',
  textDecoration: 'none',
  marginTop: 8,
};
