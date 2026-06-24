'use client';

import Link from 'next/link';

export default function RoadmapError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={containerStyle}>
      <span style={{ fontSize: 64 }}>🗺️</span>
      <h2 style={headingStyle}>Yol haritası yüklenirken hata oluştu</h2>
      <p style={bodyStyle}>
        {error.message || 'Sunucuyla bağlantı kurulamadı. Lütfen tekrar deneyin.'}
      </p>
      <div style={btnGroupStyle}>
        <button onClick={reset} style={btnPrimaryStyle}>
          Tekrar Dene
        </button>
        <Link href="/" style={btnSecondaryStyle}>
          Ana Sayfaya Dön
        </Link>
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  gap: 12,
  textAlign: 'center',
  padding: 24,
  background: '#f7f7f3',
};

const headingStyle: React.CSSProperties = {
  fontFamily: "'DM Sans', system-ui, sans-serif",
  fontSize: 20,
  fontWeight: 500,
  color: '#1c1917',
};

const bodyStyle: React.CSSProperties = {
  fontFamily: "'DM Sans', system-ui, sans-serif",
  fontSize: 15,
  color: '#57534e',
  lineHeight: 1.5,
  maxWidth: 400,
};

const btnGroupStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  marginTop: 8,
};

const btnPrimaryStyle: React.CSSProperties = {
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
};

const btnSecondaryStyle: React.CSSProperties = {
  fontFamily: "'DM Sans', system-ui, sans-serif",
  fontSize: 15,
  fontWeight: 500,
  color: '#4d7c0f',
  background: 'transparent',
  padding: '10px 24px',
  borderRadius: 9999,
  border: '1px solid #4d7c0f',
  cursor: 'pointer',
  textDecoration: 'none',
};
