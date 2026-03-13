import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

let app = null;
try {
  if (!firebaseConfig || !firebaseConfig.projectId || !firebaseConfig.apiKey) {
    console.warn('Firebase config missing. Set values in .env.local');
  } else {
    app = initializeApp(firebaseConfig);
  }
} catch (e) {
  console.error('Firebase initialization error:', e);
}

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;