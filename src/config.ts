import { GoogleGenAI } from "@google/genai";

export const config = {
  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID || "",
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || "",
    redirectUri: process.env.SPOTIFY_REDIRECT_URI || `${process.env.APP_URL}/auth/callback`,
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || "",
  },
  jwtSecret: process.env.JWT_SECRET || "moody-secret-key",
  appUrl: process.env.APP_URL || "http://localhost:3000",
};

export const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });
