import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let syncing = false;
let firestore;

function firebaseVoteEvent(event) {
  // Keep Firebase as an anonymous tally/audit: do not store which answer a
  // particular person pressed (or a custom written answer).
  const { answer: _answer, ...data } = event.data || {};
  const base = {
    eventId: event.id,
    eventType: event.type,
    eventAt: event.timestamp,
    ...data,
  };
  if (!event.type.startsWith('theme.')) return base;
  return {
    ...base,
    // Friendly fields for the Firebase Console. `suggestedAt` stays the same
    // across a theme's later Aye/Nay votes; `eventAt` is when this vote happened.
    theme: data.theme,
    suggestedBy: data.suggestedBy,
    suggestedAt: data.suggestedAt || event.timestamp,
    ayeCount: data.aye,
    nayCount: data.nay,
    noOpinionCount: data.noOpinion,
  };
}

export function firebaseConfigured() {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON && process.env.FIREBASE_PROJECT_ID);
}

function database() {
  if (firestore) return firestore;
  if (!firebaseConfigured()) throw new Error('Firebase is not configured.');
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
  }
  const app = getApps().find(app => app.name === 'bros-jam-votes') || initializeApp({
    credential: cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID,
  }, 'bros-jam-votes');
  firestore = getFirestore(app);
  return firestore;
}

// Every event is stored by its UUID. Retrying after a host restart overwrites
// the same document instead of producing duplicate votes.
export async function flushFirebaseEvents(repository) {
  if (!firebaseConfigured() || syncing) return;
  syncing = true;
  try {
    const db = database();
    for (const event of repository.pendingFirebaseEvents(100)) {
      try {
        // Firestore subcollections must live under a document. This creates:
        // october (collection) -> jam-data (document) -> votes (collection).
        await db.collection(process.env.FIREBASE_COLLECTION || 'october').doc('jam-data').collection('votes').doc(event.id).set({
          ...firebaseVoteEvent(event),
          syncedAt: new Date().toISOString(),
        });
        repository.completeFirebaseEvent(event.id);
      } catch (error) {
        console.error('Firebase sync paused:', error.message);
        break;
      }
    }
  } finally {
    syncing = false;
  }
}
