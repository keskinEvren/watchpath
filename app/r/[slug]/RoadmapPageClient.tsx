'use client';

import { useEffect, useState, useCallback } from 'react';
import type { RoadmapDetailResponse, RoadmapStatus } from '@/types';
import RoadmapCanvas from '@/components/roadmap/RoadmapCanvas';
import LoadingOverlay from '@/components/shared/LoadingOverlay';
import NavBar from '@/components/shared/NavBar';

interface Props {
  slug: string;
}

export default function RoadmapPageClient({ slug }: Props) {
  const [data, setData] = useState<RoadmapDetailResponse | null>(null);
  const [status, setStatus] = useState<RoadmapStatus | 'loading' | 'not_found'>(
    'loading',
  );
  const [error, setError] = useState<string | null>(null);

  const fetchRoadmap = useCallback(async () => {
    try {
      const res = await fetch(`/api/roadmap/${slug}`);
      if (res.status === 404) {
        setStatus('not_found');
        return 'not_found' as const;
      }
      if (!res.ok) {
        setStatus('failed');
        setError('Yol haritası yüklenirken bir hata oluştu.');
        return 'failed' as const;
      }
      const json: RoadmapDetailResponse = await res.json();
      setData(json);
      setStatus(json.roadmap.status);
      return json.roadmap.status;
    } catch {
      setStatus('failed');
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
      if (result === 'generating') {
        interval = setInterval(async () => {
          if (cancelled) return;
          const s = await fetchRoadmap();
          if (s !== 'generating' && interval) {
            clearInterval(interval);
            interval = null;
          }
        }, 2000);
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [fetchRoadmap]);

  // --- Loading / generating ---
  if (status === 'loading' || status === 'generating') {
    return <LoadingOverlay status="searching" />;
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
          <button onClick={fetchRoadmap} style={ctaBtnStyle}>
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  // --- Ready ---
  return (
    <>
      <NavBar />
      <RoadmapCanvas
        nodes={data.nodes}
        edges={data.roadmap.edges_data}
        videos={data.videos}
        topic={data.roadmap.topic}
        level={data.roadmap.level}
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
