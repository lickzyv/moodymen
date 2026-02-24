import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import axios from "axios";
import { GoogleGenAI, Type } from "@google/genai";
import db from "./server/db";
import { v4 as uuidv4 } from "uuid";

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "moody-secret-key";

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

  // --- Spotify OAuth Routes ---

  app.get("/api/auth/url", (req, res) => {
    const scope = [
      "user-read-email",
      "playlist-modify-public",
      "playlist-modify-private",
      "user-read-playback-state",
      "user-modify-playback-state",
      "streaming",
      "user-read-private"
    ].join(" ");

    const params = new URLSearchParams({
      client_id: process.env.SPOTIFY_CLIENT_ID!,
      response_type: "code",
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI || `${process.env.APP_URL}/auth/callback`,
      scope: scope,
      show_dialog: "true",
    });

    res.json({ url: `https://accounts.spotify.com/authorize?${params.toString()}` });
  });

  app.get("/auth/callback", async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send("No code provided");

    try {
      const tokenResponse = await axios.post(
        "https://accounts.spotify.com/api/token",
        new URLSearchParams({
          grant_type: "authorization_code",
          code: code as string,
          redirect_uri: process.env.SPOTIFY_REDIRECT_URI || `${process.env.APP_URL}/auth/callback`,
        }),
        {
          headers: {
            Authorization: `Basic ${Buffer.from(
              `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
            ).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      const { access_token, refresh_token } = tokenResponse.data;

      // Get user profile from Spotify
      const userResponse = await axios.get("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      const spotifyUser = userResponse.data;
      
      // Upsert user in DB
      let user = db.prepare("SELECT * FROM users WHERE spotifyId = ?").get(spotifyUser.id) as any;
      
      if (!user) {
        const userId = uuidv4();
        db.prepare(`
          INSERT INTO users (id, username, email, spotifyId, profilePicture, badges)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          userId,
          spotifyUser.display_name || spotifyUser.id,
          spotifyUser.email,
          spotifyUser.id,
          spotifyUser.images?.[0]?.url || "",
          JSON.stringify(["Verified User"])
        );
        user = { id: userId, spotifyId: spotifyUser.id };
      }

      const token = jwt.sign({ userId: user.id, spotifyAccessToken: access_token }, JWT_SECRET, { expiresIn: "1h" });

      res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
      });

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error("Spotify Auth Error:", error.response?.data || error.message);
      res.status(500).send("Authentication failed");
    }
  });

  // --- Middleware ---
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  // --- API Routes ---

  app.get("/api/me", authenticate, (req: any, res) => {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.userId) as any;
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({
      ...user,
      badges: JSON.parse(user.badges || "[]")
    });
  });

  app.post("/api/generate-playlist", authenticate, async (req: any, res) => {
    const { mood } = req.body;
    if (!mood) return res.status(400).json({ error: "Mood is required" });

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a 20-track playlist for the mood: "${mood}". Return ONLY a JSON object with playlist_name, description, and songs array (each song should have "title" and "artist").`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              playlist_name: { type: Type.STRING },
              description: { type: Type.STRING },
              songs: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    artist: { type: Type.STRING },
                  },
                  required: ["title", "artist"],
                },
              },
            },
            required: ["playlist_name", "description", "songs"],
          },
        },
      });

      const playlistData = JSON.parse(response.text);
      res.json(playlistData);
    } catch (error) {
      console.error("Gemini Error:", error);
      res.status(500).json({ error: "Failed to generate playlist" });
    }
  });

  app.post("/api/save-playlist", authenticate, (req: any, res) => {
    const { name, description, songs } = req.body;
    const id = uuidv4();
    db.prepare(`
      INSERT INTO playlists (id, name, description, songs, createdBy)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, name, description, JSON.stringify(songs), req.user.userId);
    res.json({ id, name, description, songs });
  });

  app.get("/api/playlists", authenticate, (req: any, res) => {
    const playlists = db.prepare("SELECT * FROM playlists WHERE createdBy = ?").all(req.user.userId) as any[];
    res.json(playlists.map(p => ({
      ...p,
      songs: JSON.parse(p.songs)
    })));
  });

  app.post("/api/logout", (req, res) => {
    res.clearCookie("token", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });
    res.json({ success: true });
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
