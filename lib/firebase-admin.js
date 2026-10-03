import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export function verificationDb() {
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error('Firebase is not configured.');
  let serviceAccount;
  try { serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON); }
  catch { throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.'); }
  const app = getApps().find(item => item.name === 'bros-jam-verification') || initializeApp({ credential: cert(serviceAccount), projectId: process.env.FIREBASE_PROJECT_ID }, 'bros-jam-verification');
  return getFirestore(app);
}
