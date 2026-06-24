'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={containerStyle}>
      <span style={{ fontSize: 64 }}>⚠️</span>
      <h2 style={headingStyle}>Beklenmeyen bir hata oluştu</h2>
      <p style={bodyStyle}>
        {error.message || 'Bir şeyler ters gitti. Lütfen tekrar deneyin.'}
      </p>
      <button onClick={reset} style={btnStyle}>
        Tekrar Dene
      </button>
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

const btnStyle: React.CSSProperties = {
  fontFamily: "'DM Sans', system-ui, sans-serif",
  fontSize: 15,
  fontWeight: 500,
  color: '#ffffff',
  background: '#4d7c0f',
  padding: '10px 24px',
  borderRadius: 9999,
  border: 'none',
  cursor: 'pointer',
  marginTop: 8,
};
