import { ImageResponse } from 'next/og';

export const dynamic = 'force-static';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #131A2A 0%, #060A13 100%)',
          position: 'relative',
        }}
      >
        {/* Massive inner ambient glow using box-shadow */}
        <div style={{
          position: 'absolute',
          width: '0px',
          height: '0px',
          boxShadow: '0 0 120px 60px rgba(0, 212, 170, 0.2)',
        }} />

        {/* Outer dashed ring */}
        <div style={{
          position: 'absolute',
          width: '140px',
          height: '140px',
          borderRadius: '70px',
          border: '3px dashed rgba(0, 212, 170, 0.4)',
        }} />

        {/* Middle solid ring */}
        <div style={{
          position: 'absolute',
          width: '100px',
          height: '100px',
          borderRadius: '50px',
          border: '5px solid rgba(0, 255, 208, 0.7)',
        }} />

        {/* Inner active ring representation */}
        <div style={{
          position: 'absolute',
          width: '60px',
          height: '60px',
          borderRadius: '30px',
          border: '6px solid #00FFD0',
          borderTopColor: 'transparent',
        }} />

        {/* Searing core center */}
        <div style={{
          position: 'absolute',
          width: '24px',
          height: '24px',
          borderRadius: '12px',
          backgroundColor: '#FFFFFF',
          boxShadow: '0 0 40px 15px rgba(0, 255, 208, 0.9), 0 0 80px 25px rgba(0, 212, 170, 0.5)',
        }} />
        
        {/* Premium subtle edge border */}
        <div style={{
          position: 'absolute',
          inset: 0,
          border: '2px solid rgba(0, 255, 208, 0.2)',
        }} />
      </div>
    ),
    { ...size }
  );
}
