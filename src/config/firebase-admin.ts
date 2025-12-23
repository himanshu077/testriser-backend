import * as admin from 'firebase-admin';

let firebaseApp: admin.app.App;

/**
 * Initialize Firebase Admin SDK
 * Can use either service account file or environment variables
 */
export function initializeFirebaseAdmin() {
  if (firebaseApp) {
    return firebaseApp;
  }

  try {
    // Option 1: Use service account file (recommended for production)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('✓ Firebase Admin initialized with service account file');
    }
    // Option 2: Use environment variables (easier for development)
    else if (
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_PRIVATE_KEY &&
      process.env.FIREBASE_CLIENT_EMAIL
    ) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
      });
      console.log('✓ Firebase Admin initialized with environment variables');
    } else {
      console.warn('⚠ Firebase Admin not initialized - missing credentials');
      console.warn('  Set either FIREBASE_SERVICE_ACCOUNT_PATH or');
      console.warn('  FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL');
    }
  } catch (error) {
    console.error('✗ Error initializing Firebase Admin:', error);
    throw error;
  }

  return firebaseApp;
}

/**
 * Get Firebase Admin instance
 */
export function getFirebaseAdmin(): admin.app.App {
  if (!firebaseApp) {
    return initializeFirebaseAdmin();
  }
  return firebaseApp;
}

/**
 * Get Firebase Auth instance
 */
export function getFirebaseAuth(): admin.auth.Auth {
  return getFirebaseAdmin().auth();
}

/**
 * Verify Firebase ID token
 * @param idToken - Firebase ID token from client
 * @returns Decoded token with user information
 */
export async function verifyFirebaseToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
  try {
    const decodedToken = await getFirebaseAuth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error: any) {
    console.error('Firebase token verification error:', error.message);
    throw new Error('Invalid or expired Firebase token');
  }
}

/**
 * Get user from Firebase by UID
 * @param uid - Firebase user ID
 * @returns Firebase user record
 */
export async function getFirebaseUser(uid: string): Promise<admin.auth.UserRecord> {
  try {
    return await getFirebaseAuth().getUser(uid);
  } catch (error: any) {
    console.error('Error getting Firebase user:', error.message);
    throw new Error('User not found');
  }
}
