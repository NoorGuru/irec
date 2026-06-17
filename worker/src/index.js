/**
 * Cloudflare Worker: YouTube Transcript Proxy
 *
 * Uses YouTube's innertube player API with ANDROID client to get transcript URLs
 * that don't require PO tokens, then fetches the actual transcript XML.
 *
 * GET /transcript?v=VIDEO_ID
 * GET /debug?v=VIDEO_ID
 */

const ALLOWED_ORIGINS = [
  'https://aura.bynoor.io',
  'http://localhost:3000',
  'http://localhost:8000',
];

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

// Same context the youtube-transcript-api library uses
const INNERTUBE_CONTEXT = {
  client: {
    clientName: 'ANDROID',
    clientVersion: '20.10.38',
  },
};

/**
 * Step 1: Fetch the YouTube page to extract the innertube API key
 */
async function getApiKey(videoId) {
  const resp = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!resp.ok) throw new Error(`Page fetch failed: ${resp.status}`);
  const html = await resp.text();

  const match = html.match(/"INNERTUBE_API_KEY"\s*:\s*"([a-zA-Z0-9_-]+)"/);
  if (!match) {
    if (html.includes('class="g-recaptcha"')) {
      throw new Error('YouTube is showing CAPTCHA (IP blocked)');
    }
    throw new Error('Could not extract API key from page');
  }

  return match[1];
}

/**
 * Step 2: Call innertube player API to get caption tracks (ANDROID client, no PO token needed)
 */
async function getCaptionTracks(videoId, apiKey) {
  const resp = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 13; en_US)',
    },
    body: JSON.stringify({
      context: INNERTUBE_CONTEXT,
      videoId: videoId,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Player API returned ${resp.status}: ${text.substring(0, 200)}`);
  }

  const data = await resp.json();

  // Check playability
  const playability = data.playabilityStatus;
  if (playability && playability.status !== 'OK') {
    throw new Error(`Video not playable: ${playability.reason || playability.status}`);
  }

  const captions = data.captions;
  if (!captions) {
    throw new Error('No captions data in player response (video may not have subtitles)');
  }

  const tracks = captions.playerCaptionsTracklistRenderer?.captionTracks;
  if (!tracks || tracks.length === 0) {
    throw new Error('No caption tracks available');
  }

  return { tracks, data };
}

/**
 * Step 3: Fetch and parse the transcript from a track URL
 */
async function fetchTranscriptFromTrack(track) {
  let url = (typeof track === 'string' ? track : track.baseUrl).replace(/&amp;/g, '&');

  // Remove variant=gemini and exp=xpe which cause empty responses
  url = url.replace(/&variant=[^&]+/g, '');
  url = url.replace(/&exp=[^&]+/g, '');

  // Try XML format (most reliable for ANDROID client URLs)
  const xmlResp = await fetch(url, {
    headers: {
      'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 13; en_US)',
    },
  });

  if (!xmlResp.ok) {
    throw new Error(`Transcript URL returned ${xmlResp.status}`);
  }

  const xml = await xmlResp.text();
  if (!xml || xml.length === 0) {
    // Try with json3 format
    const json3Resp = await fetch(url + '&fmt=json3', {
      headers: {
        'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 13; en_US)',
      },
    });
    if (json3Resp.ok) {
      const j3Text = await json3Resp.text();
      if (j3Text.length > 0) {
        const data = JSON.parse(j3Text);
        const segments = [];
        for (const event of (data.events || [])) {
          for (const seg of (event.segs || [])) {
            const t = (seg.utf8 || '').replace(/\n/g, ' ').trim();
            if (t) segments.push(t);
          }
        }
        if (segments.length > 0) return segments.join(' ');
      }
    }
    throw new Error('Empty response from transcript URL (both XML and json3)');
  }

  // Parse XML
  const segments = [];

  // Format 3 (srv3): uses <p> with <s> children
  const srv3Regex = /<s[^>]*>([^<]*)<\/s>/g;
  let match;
  while ((match = srv3Regex.exec(xml)) !== null) {
    const t = match[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n/g, ' ')
      .trim();
    if (t) segments.push(t);
  }

  // Fallback: classic format uses <text> tags
  if (segments.length === 0) {
    const textRegex = /<text[^>]*>([\s\S]*?)<\/text>/g;
    while ((match = textRegex.exec(xml)) !== null) {
      const t = match[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n/g, ' ')
        .trim();
      if (t) segments.push(t);
    }
  }

  if (segments.length === 0) {
    throw new Error(`Could not parse XML transcript (length: ${xml.length}, preview: ${xml.substring(0, 100)})`);
  }

  return segments.join(' ');
}

// Public innertube API key (same for all users, rarely changes)
const INNERTUBE_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

async function getTranscript(videoId) {
  // Try player API first (faster, single request)
  try {
    const { tracks } = await getCaptionTracks(videoId, INNERTUBE_API_KEY);
    const track = tracks.find(t => t.languageCode === 'en' && t.kind !== 'asr')
      || tracks.find(t => t.languageCode === 'en')
      || tracks.find(t => t.languageCode?.startsWith('en'))
      || tracks[0];

    if (track?.baseUrl) {
      return await fetchTranscriptFromTrack(track);
    }
  } catch (e) {
    // Player API blocked — fall back to page scraping
  }

  // Fallback: fetch video page and extract captions from HTML
  const pageResp = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!pageResp.ok) {
    throw new Error(`All methods failed. Player API and page fetch both returned errors (page: ${pageResp.status})`);
  }

  const html = await pageResp.text();
  const tracksJson = extractCaptionTracks(html);
  if (!tracksJson) {
    throw new Error('No captions found (player API blocked, page has no tracks)');
  }

  const tracks = JSON.parse(tracksJson);
  const track = tracks.find(t => t.languageCode === 'en' && t.kind !== 'asr')
    || tracks.find(t => t.languageCode === 'en')
    || tracks.find(t => t.languageCode?.startsWith('en'))
    || tracks[0];

  if (!track?.baseUrl) {
    throw new Error('No usable caption track in page data');
  }

  return await fetchTranscriptFromTrack(track);
}

/**
 * Extract the captionTracks JSON array from YouTube page HTML.
 */
function extractCaptionTracks(html) {
  const marker = '"captionTracks":';
  const startIdx = html.indexOf(marker);
  if (startIdx === -1) return null;

  const arrayStart = html.indexOf('[', startIdx + marker.length);
  if (arrayStart === -1) return null;

  let depth = 0;
  for (let i = arrayStart; i < html.length && i < arrayStart + 100000; i++) {
    if (html[i] === '[') depth++;
    else if (html[i] === ']') {
      depth--;
      if (depth === 0) return html.substring(arrayStart, i + 1);
    }
  }
  return null;
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    const url = new URL(request.url);

    // Debug endpoint
    if (url.pathname === '/debug') {
      const videoId = url.searchParams.get('v');
      if (!videoId) {
        return new Response(JSON.stringify({ error: 'Need ?v=VIDEO_ID' }), {
          status: 400, headers: { 'Content-Type': 'application/json' },
        });
      }
      try {
        const { tracks, data } = await getCaptionTracks(videoId, INNERTUBE_API_KEY);
        const track = tracks[0];
        let cleanUrl = (track.baseUrl || '').replace(/&amp;/g, '&').replace(/&variant=[^&]+/g, '').replace(/&exp=[^&]+/g, '');

        // Test fetch
        const testResp = await fetch(cleanUrl, {
          headers: { 'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 13; en_US)' },
        });
        const testText = await testResp.text();

        return new Response(JSON.stringify({
          tracksCount: tracks.length,
          track: { lang: track.languageCode, kind: track.kind, baseUrlLength: track.baseUrl.length },
          cleanUrl,
          hasExpXpe: track.baseUrl.includes('exp=xpe'),
          hasVariant: track.baseUrl.includes('variant='),
          testFetch: { status: testResp.status, length: testText.length, preview: testText.substring(0, 300) },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Main transcript endpoint
    if (url.pathname !== '/transcript') {
      return new Response(JSON.stringify({ error: 'Use /transcript?v=VIDEO_ID' }), {
        status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
      });
    }

    const videoId = url.searchParams.get('v');
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return new Response(JSON.stringify({ error: 'Invalid or missing video ID' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
      });
    }

    try {
      const transcript = await getTranscript(videoId);
      return new Response(JSON.stringify({ transcript, length: transcript.length }), {
        status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 422, headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
      });
    }
  },
};
