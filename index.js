import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const GEMINI_MODEL = 'gemini-2.5-flash';

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '20mb' }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 1 day
}));

// ─── Passport / Google OAuth Setup ───────────────────────────────────────────
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: 'http://localhost:3000/auth/google/callback'
}, (accessToken, refreshToken, profile, done) => {
  // Store relevant user info
  const user = {
    id: profile.id,
    name: profile.displayName,
    email: profile.emails?.[0]?.value,
    photo: profile.photos?.[0]?.value
  };
  return done(null, user);
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

app.use(passport.initialize());
app.use(passport.session());

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function isAuthenticated(req, res, next) {
  // If Google credentials are not configured, skip auth (demo mode)
  if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID === 'your_google_client_id_here') {
    return next();
  }
  if (req.isAuthenticated()) return next();
  res.redirect('/login.html');
}

// ─── Google OAuth Routes ──────────────────────────────────────────────────────
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login.html' }),
  (req, res) => res.redirect('/')
);

app.get('/auth/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/login.html');
  });
});

// ─── API: Get Current User ────────────────────────────────────────────────────
app.get('/api/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ loggedIn: true, user: req.user });
  } else if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID === 'your_google_client_id_here') {
    res.json({ loggedIn: true, user: { name: 'Demo User', email: '', photo: '' }, demo: true });
  } else {
    res.json({ loggedIn: false });
  }
});

// ─── Serve Static Files ───────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Protect Main Chat Route ──────────────────────────────────────────────────
app.get('/', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── API: Chat Endpoint (Supports Text + Image) ───────────────────────────────
app.post('/api/chat', isAuthenticated, async (req, res) => {
  const { conversation, imageData, imageMimeType } = req.body;
  try {
    if (!Array.isArray(conversation)) {
      throw new Error('conversation harus berupa array!');
    }

    // Build contents array from conversation history
    const contents = conversation.map(({ role, text }, index) => {
      // If it's the last user message AND an image is provided, include image
      const isLastUserMsg = index === conversation.length - 1 && role === 'user';
      
      if (isLastUserMsg && imageData) {
        return {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: imageMimeType || 'image/jpeg',
                data: imageData
              }
            },
            { text: text || 'Apa yang ada di gambar ini?' }
          ]
        };
      }

      return {
        role,
        parts: [{ text }]
      };
    });

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        temperature: 0.9,
        systemInstruction: 'Jawab hanya menggunakan bahasa Indonesia. Anda adalah asisten virtual pintar yang ramah dan siap membantu. Ketika diberikan gambar, analisa dan deskripsikan dengan detail.'
      }
    });

    res.status(200).json({ result: response.text });
  } catch (e) {
    console.error('Error pada /api/chat:', e);
    res.status(500).json({ error: e.message });
  }
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server berjalan di http://localhost:${PORT}`);
  const googleConfigured = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id_here';
  console.log(`🔐 Google Login: ${googleConfigured ? 'AKTIF' : 'BELUM DIKONFIGURASI (mode demo)'}`);
});
