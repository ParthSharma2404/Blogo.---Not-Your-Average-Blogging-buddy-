const admin = require('firebase-admin');

let initialized = false;
let adminInstance = null;
let firestore = null;

function initFirebaseAdmin() {
  if (initialized) return { admin: adminInstance, firestore };

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  // Handle escaped newlines and quotes in env var
  if (privateKey && privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }
  if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  if (!projectId || !clientEmail || !privateKey) {
    console.warn('Firebase Admin env vars missing. Backend Firestore not initialized.');
    initialized = true; // Prevent repeated logs
    return { admin: null, firestore: null };
  }

  try {
    adminInstance = admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
    firestore = adminInstance.firestore();
    initialized = true;
    console.log('✅ Firebase Admin initialized for backend');
  } catch (e) {
    console.error('❌ Failed to initialize Firebase Admin:', e.message);
    initialized = true;
  }

  return { admin: adminInstance, firestore };
}

const { admin: adminExport, firestore: firestoreExport } = initFirebaseAdmin();

module.exports = { admin: adminExport, firestore: firestoreExport };