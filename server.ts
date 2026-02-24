import dotenv from "dotenv";
dotenv.config(); // MUST be first

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import axios from "axios";
import { GoogleGenAI, Type } from "@google/genai";
import db from "./server/db.ts";
import { v4 as uuidv4 } from "uuid";

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "moody-secret-key";

async function startServer() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is missing in .env file");
    process.exit(1);
  }

  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    console.error("Spotify credentials missing in .env file");
    process.exit(1);
  }

  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  // --- Spotify OAuth Routes ---

  app.get("/api/auth/url", (req, res) => {
    const scope = [
      "user-read-email",
      "playlist-modify-public",
      "playlist-modify-private",
      "user-read-playback-state",
      "user-modify-playback-state",
      "streaming",
      "user-read-private",
    ].join(" ");

    const params = new URLSearchParams({
      client_id: process.env.SPOTIFY_CLIENT_ID!,
      response_type: "code",
      redirect_uri:
        process.env.SPOTIFY_REDIRECT_URI ||
        `${process.env.APP_URL}/auth/callback`,
      scope: scope,
      show_dialog: "true",
    });

    res.json({
      url: `https://accounts.spotify.com/authorize?${params.toString()}`,
    });
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
          redirect_uri:
            process.env.SPOTIFY_REDIRECT_URI ||
            `${process.env.APP_URL}/auth/callback`,
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

      const { access_token } = tokenResponse.data;

      const userResponse = await axios.get(
        "https://api.spotify.com/v1/me",
        {
          headers: { Authorization: `Bearer ${access_token}` },
        }
      );

      const spotifyUser = userResponse.data;

      let user = db
        .prepare("SELECT * FROM users WHERE spotifyId = ?")
        .get(spotifyUser.id) as any;

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

        user = { id: userId };
      }

      const token = jwt.sign(
        { userId: user.id, spotifyAccessToken: access_token },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      res.cookie("token", token, {
        httpOnly: true,
        secure: false, // IMPORTANT for localhost
        sameSite: "lax",
      });

      res.redirect("/");
    } catch (error: any) {
      console.error("Spotify Auth Error:", error.response?.data || error.message);
      res.status(500).send("Authentication failed");
    }
  });

  // --- Auth Middleware ---

  const authenticate = (req: any, res: any, next: any) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = decoded;
      next();
    } catch {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  // --- Generate Playlist ---

  app.post("/api/generate-playlist", authenticate, async (req: any, res) => {
    const { mood } = req.body;
    if (!mood) return res.status(400).json({ error: "Mood is required" });

    try {
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: `Generate a 20-track playlist for the mood: "${mood}". Return ONLY JSON with playlist_name, description, and songs (title + artist).`,
      });

      const playlistData = JSON.parse(response.text);
      res.json(playlistData);
    } catch (error) {
      console.error("Gemini Error:", error);
      res.status(500).json({ error: "Failed to generate playlist" });
    }
  });

  // --- Dev / Prod Handling ---

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