import { ImageResponse } from 'next/og';
import { readFileSync } from 'fs';
import { join } from 'path';

export const alt = 'aura — Stock Sentiment from YouTube Analysts';
export const dynamic = 'force-static';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  // Load the stunning, generated AI background image
  let bgBase64 = '';
  try {
    const bgData = readFileSync(join(process.cwd(), 'public/og-bg.png'));
    bgBase64 = bgData.toString('base64');
  } catch (e) {
    console.error('Failed to load og-bg.png, make sure it is in the public directory.');
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0A0F1A',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Raster background image cropped to cover */}
        {bgBase64 && (
          <svg
            width="1200"
            height="630"
            style={{ position: 'absolute', top: 0, left: 0 }}
          >
            <image
              href={`data:image/png;base64,${bgBase64}`}
              width="1200"
              height="630"
              preserveAspectRatio="xMidYMid slice"
            />
            {/* A dark gradient overlay to ensure text readability */}
            <defs>
              <linearGradient id="overlay" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#0A0F1A" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#0A0F1A" stopOpacity="0.8" />
              </linearGradient>
            </defs>
            <rect width="1200" height="630" fill="url(#overlay)" />
          </svg>
        )}

        {/* Content container - striking center layout */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
            height: '100%',
            padding: '80px',
            position: 'relative',
          }}
        >
          {/* Huge center text - 250px! */}
          <div
            style={{
              fontSize: 250,
              fontWeight: 700,
              letterSpacing: '-0.07em',
              lineHeight: 0.85,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textShadow: '0px 30px 60px rgba(0,0,0,0.7)',
            }}
          >
            <div
              style={{
                backgroundImage: 'linear-gradient(135deg, #00FFD0 0%, #00D4AA 50%, #0088AA 100%)',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              AURA.
            </div>
          </div>

          {/* Badge / Tagline with Glassmorphism effect */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(20, 27, 45, 0.6)',
              padding: '20px 48px',
              borderRadius: '100px',
              border: '2px solid rgba(0, 255, 208, 0.3)',
              marginTop: 60,
              boxShadow: '0 12px 40px rgba(0, 212, 170, 0.2)',
            }}
          >
            <span
              style={{
                fontSize: 32,
                color: '#E2E8F0',
                fontWeight: 700,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
              }}
            >
              YouTube Sentiment Engine
            </span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
