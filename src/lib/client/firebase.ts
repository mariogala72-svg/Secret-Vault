"use client";
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";

let auth: Auth | null = null;

export function firebaseConfigured() {
  return !!(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
}

export function clientAuth(): Auth {
  if (auth) return auth;
  const app: FirebaseApp =
    getApps()[0] ??
    initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    });
  auth = getAuth(app);
  auth.languageCode = "it";
  if (process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR) connectAuthEmulator(auth, process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR, { disableWarnings: true });
  return auth;
}
