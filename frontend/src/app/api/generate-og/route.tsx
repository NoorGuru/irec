import { ImageResponse } from 'next/og';
import { readFileSync } from 'fs';
import { join } from 'path';
export const dynamic = 'force-static';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return new Response('OG generation bypassed in production build', {
      headers: { 'Content-Type': 'text/plain' },
    });
  }

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
              color: '#00FFD0',
            }}
          >
            <div>
              AURA
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
              Every stock analyst. One clear signal.
            </span>
          </div>

          {/* Sub-headline */}
          <div
            style={{
              marginTop: 40,
              fontSize: 32,
              color: '#8B95A8',
              fontWeight: 400,
              textAlign: 'center',
              maxWidth: '900px',
              lineHeight: 1.4,
            }}
          >
            Discover market-moving conviction by tracking real-time sentiment across top YouTube finance channels.
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
