import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let app: App | undefined;
let firestore: Firestore | undefined;

function adminApp(): App {
  if (app) return app;
  if (getApps().length) return (app = getApps()[0]);
  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST) {
    return (app = initializeApp({ projectId }));
  }
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin non configurato: imposta FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY");
  }
  return (app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }));
}

export function db(): Firestore {
  if (!firestore) {
    firestore = getFirestore(adminApp());
    firestore.settings({ ignoreUndefinedProperties: true });
  }
  return firestore;
}

export const adminAuth = () => getAuth(adminApp());
