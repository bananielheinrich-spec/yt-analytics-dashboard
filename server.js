const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const { google } = require('googleapis');

dotenv.config();

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(express.static(__dirname));

// Dynamische Redirect-URI (funktioniert lokal und online)
const redirectUri = process.env.REDIRECT_URI || 'http://localhost:3000/auth/callback';

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  redirectUri
);

function parseISODuration(duration) {
  if (!duration || typeof duration !== 'string') return 0;
  const matches = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!matches) return 0;
  const hours = Number(matches[1] || 0);
  const minutes = Number(matches[2] || 0);
  const seconds = Number(matches[3] || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function getStoredTokens(req) {
  const tokenCookie = req.cookies?.tokens;
  if (!tokenCookie) return null;
  try {
    return JSON.parse(tokenCookie);
  } catch (error) {
    return null;
  }
}

function setTokenCookie(res, tokens) {
  res.cookie('tokens', JSON.stringify(tokens), {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 1000 * 60 * 60 * 24 * 7
  });
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/auth/google', (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/yt-analytics.readonly'
  ];
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
  res.redirect(url);
});

app.get(['/auth/callback', '/oauth/google/callback'], async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send('OAuth code missing');
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    setTokenCookie(res, tokens);
    res.redirect('/');
  } catch (error) {
    res.status(500).json({ error: 'OAuth failed', details: error.message });
  }
});

app.get('/api/auth/status', (req, res) => {
  const tokens = getStoredTokens(req);
  res.json({ authenticated: Boolean(tokens?.access_token) });
});

app.get('/api/dashboard', async (req, res) => {
  const tokens = getStoredTokens(req);
  if (!tokens?.access_token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    oauth2Client.setCredentials(tokens);
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    const analytics = google.youtubeAnalytics({ version: 'v2', auth: oauth2Client });

    const channelRes = await youtube.channels.list({
      part: ['snippet', 'statistics'],
      mine: true
    });

    const channel = channelRes.data.items?.[0];
    if (!channel) {
      return res.status(404).json({ error: 'No channel found' });
    }

    const channelData = {
      name: channel.snippet.title,
      avatar: channel.snippet.thumbnails?.default?.url || '',
      subscribers: Number(channel.statistics.subscriberCount || 0)
    };

    const rangeDays = [28, 90, 180, 365].includes(Number(req.query.range)) ? Number(req.query.range) : 28;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - (rangeDays - 1));

    const dateFormatter = (date) => date.toISOString().split('T')[0];
    const reports = await analytics.reports.query({
      ids: 'channel==MINE',
      startDate: dateFormatter(startDate),
      endDate: dateFormatter(endDate),
      metrics: 'views,estimatedMinutesWatched,subscribersGained',
      dimensions: 'day',
      sort: 'day'
    });

    const rows = reports.data.rows || [];
    const labels = rows.map(([day]) => day);
    const values = rows.map(([, views]) => Number(views || 0));
    const totalViews = values.reduce((sum, value) => sum + value, 0);
    const totalHours = rows.reduce((sum, row) => sum + Number(row[2] || 0), 0) / 60;

    const summary = {
      views: totalViews,
      watchHours: totalHours,
      subscribersGained: rows.reduce((sum, row) => sum + Number(row[3] || 0), 0)
    };

    const publishedAfter = new Date(startDate);
    publishedAfter.setUTCHours(0, 0, 0, 0);
    const publishedAfterIso = publishedAfter.toISOString();

    const videosRes = await youtube.search.list({
      part: ['snippet'],
      channelId: channel.id,
      publishedAfter: publishedAfterIso,
      order: 'viewCount',
      maxResults: 10,
      type: 'video'
    });

    const shortVideosRes = await youtube.search.list({
      part: ['snippet'],
      channelId: channel.id,
      publishedAfter: publishedAfterIso,
      order: 'viewCount',
      maxResults: 10,
      type: 'video',
      videoDuration: 'short'
    });

    const buildTopItems = async (searchItems) => {
      const ids = (searchItems || []).map((item) => item.id.videoId).filter(Boolean);
      if (ids.length === 0) return [];
      const videoDetailsRes = await youtube.videos.list({
        part: ['snippet', 'statistics', 'contentDetails'],
        id: ids.join(',')
      });

      return (videoDetailsRes.data.items || []).map((video) => {
        const averageViewDurationSeconds = Number(video.statistics.averageViewDuration || 0) || parseISODuration(video.contentDetails?.duration);
        const durationSeconds = parseISODuration(video.contentDetails?.duration);
        return {
          id: video.id,
          title: video.snippet.title,
          thumbnail: video.snippet.thumbnails?.medium?.url || '',
          views: Number(video.statistics.viewCount || 0),
          averageViewDuration: averageViewDurationSeconds,
          duration: video.contentDetails?.duration || '',
          durationSeconds,
          publishedAt: video.snippet.publishedAt
        };
      }).sort((a, b) => b.views - a.views).slice(0, 6);
    };

    const topVideos = await buildTopItems(videosRes.data.items);
    const topShorts = await buildTopItems(shortVideosRes.data.items);

    const monetization = [
      {
        label: 'Abonnenten',
        current: channelData.subscribers,
        target: 1000,
        currentDisplay: `${channelData.subscribers}`,
        targetDisplay: '1.000'
      },
      {
        label: 'Wiedergabestunden',
        current: Math.round(totalHours),
        target: 4000,
        currentDisplay: `${Math.round(totalHours)}`,
        targetDisplay: '4.000'
      },
      {
        label: 'Shorts-Views',
        current: Math.max(0, Math.round(totalViews * 0.25)),
        target: 10000000,
        currentDisplay: `${Math.max(0, Math.round(totalViews * 0.25)).toLocaleString('de-DE')}`,
        targetDisplay: '10 Mio.'
      }
    ];

    const revenueProgress = [
      {
        title: 'Abonnenten',
        description: `Du brauchst 1.000 Abonnenten. Der Kanal hat aktuell ${channelData.subscribers} Abonnenten.`,
        current: channelData.subscribers,
        target: 1000
      },
      {
        title: 'Wiedergabestunden',
        description: `Für die Monetarisierung sind 4.000 Stunden notwendig. Aktuell sind es ${Math.round(totalHours)} Stunden.`,
        current: Math.round(totalHours),
        target: 4000
      },
      {
        title: 'Shorts-Views',
        description: `Nimm 10 Mio. gültige Shorts-Views ins Visier. Aktuell sind es ca. ${Math.max(0, Math.round(totalViews * 0.25)).toLocaleString('de-DE')} Views.`,
        current: Math.max(0, Math.round(totalViews * 0.25)),
        target: 10000000
      }
    ];

    res.json({
      channel: channelData,
      summary,
      timeline: { labels, values },
      topVideos,
      topShorts,
      monetization,
      revenueProgress,
      rangeDays
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Dashboard error', details: error.message });
  }
});

app.post('/api/assistant', async (req, res) => {
  const tokens = getStoredTokens(req);
  if (!tokens?.access_token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'Missing query' });
  }

  try {
    const aiKey = process.env.API_KEY;
    if (!aiKey) {
      return res.json({ reply: 'Bitte lege einen API_KEY in der .env-Datei fest.' });
    }

    // Live-Daten für den Assistenten abrufen
    oauth2Client.setCredentials(tokens);
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    const channelRes = await youtube.channels.list({
      part: ['snippet', 'statistics'],
      mine: true
    });

    const channel = channelRes.data.items?.[0];
    const channelName = channel?.snippet?.title || 'Unbekannt';
    const subCount = channel?.statistics?.subscriberCount || '0';
    const totalViews = channel?.statistics?.viewCount || '0';
    const videoCount = channel?.statistics?.videoCount || '0';

    const systemContext = `Du bist ein hilfsreicher YouTube-Content-Analyst für den Kanal "${channelName}". 
Hier sind die aktuellen Daten des Kanals:
- Abonnenten: ${subCount}
- Gesamte Aufrufe: ${totalViews}
- Anzahl hochgeladener Videos: ${videoCount}

Antworte kurz, strukturiert und nutze diese Daten, um Fragen direkt und präzise zu beantworten.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${aiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: `${systemContext}\n\nFrage des Nutzers: ${query}` }
            ]
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini API Fehler:', data);
      return res.json({ reply: `API-Fehler: ${data.error?.message || 'Unbekannter Fehler'}` });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Ich konnte gerade keine Antwort erzeugen.';
    res.json({ reply });
  } catch (error) {
    console.error('Assistant Error:', error);
    res.status(500).json({ error: 'Assistant error', details: error.message });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});