import { ImageResponse } from 'next/og';

export const dynamic = 'force-static';
export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(180deg, #101625 0%, #060910 100%)',
          borderRadius: '16px',
          position: 'relative',
        }}
      >
        {/* Ambient Glow behind */}
        <div style={{
          position: 'absolute',
          width: '0px',
          height: '0px',
          boxShadow: '0 0 40px 20px rgba(0, 212, 170, 0.3)',
        }} />

        {/* Outer dashed ring */}
        <div style={{
          position: 'absolute',
          width: '46px',
          height: '46px',
          borderRadius: '23px',
          border: '2px dashed rgba(0, 212, 170, 0.5)',
        }} />
        
        {/* Active solid ring */}
        <div style={{
          position: 'absolute',
          width: '30px',
          height: '30px',
          borderRadius: '15px',
          border: '3px solid rgba(0, 255, 208, 0.8)',
          borderTopColor: 'transparent',
        }} />
        
        {/* Searing bright core */}
        <div style={{
          position: 'absolute',
          width: '12px',
          height: '12px',
          borderRadius: '6px',
          backgroundColor: '#FFFFFF',
          boxShadow: '0 0 16px 6px rgba(0, 255, 208, 1)',
        }} />
      </div>
    ),
    { ...size }
  );
}
