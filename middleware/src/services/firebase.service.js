import fs from 'node:fs';
import path from 'node:path';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import { OAuth2Client } from 'google-auth-library';

const DEFAULT_GOOGLE_WEB_CLIENT_ID =
  '1090454074390-i0unlvauvvkntq6kt01vf5ljaaql35pj.apps.googleusercontent.com';

const ALLOWED_GOOGLE_AUDIENCES = Array.from(
  new Set(
    [
      ...(process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.split(',').map((s) => s.trim()) : []),
      ...(process.env.GOOGLE_WEB_CLIENT_ID ? [process.env.GOOGLE_WEB_CLIENT_ID.trim()] : []),
      DEFAULT_GOOGLE_WEB_CLIENT_ID,
    ].filter(Boolean)
  )
);

const googleOAuthClient = new OAuth2Client();

let isFirebaseInitialized = false;
let firebaseApp = null;

/**
 * Initialize Firebase Admin SDK using Environment variables or Service Account JSON
 */
const initializeFirebaseAdmin = () => {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    firebaseApp = existingApps[0];
    isFirebaseInitialized = true;
    return;
  }

  // 1. Check for Service Account JSON file path or default file
  const candidatePaths = [
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    path.resolve(process.cwd(), '``firebase-service-account.json``'),
    path.resolve(process.cwd(), 'middleware/firebase-service-account.json'),
  ].filter(Boolean);

  for (const filePath of candidatePaths) {
    if (fs.existsSync(filePath)) {
      try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const serviceAccount = JSON.parse(fileContent);
        firebaseApp = initializeApp({
          credential: cert(serviceAccount),
        });
        isFirebaseInitialized = true;
        console.log(`✅ Firebase Admin SDK initialized successfully from ${path.basename(filePath)}.`);
        return;
      } catch (err) {
        console.warn(`⚠️ Failed to parse service account file at ${filePath}:`, err.message);
      }
    }
  }

  // 2. Check for Service Account JSON string in environment variable
  const rawKeyJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (rawKeyJson) {
    try {
      const serviceAccount = JSON.parse(rawKeyJson);
      firebaseApp = initializeApp({
        credential: cert(serviceAccount),
      });
      isFirebaseInitialized = true;
      console.log('✅ Firebase Admin SDK initialized successfully from FIREBASE_SERVICE_ACCOUNT_KEY.');
      return;
    } catch (err) {
      console.warn('⚠️ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON string:', err.message);
    }
  }

  // 3. Check for individual environment variables
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    try {
      if (privateKey.includes(String.raw`\n`)) {
        privateKey = privateKey.replaceAll(String.raw`\n`, '\n');
      }

      firebaseApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      isFirebaseInitialized = true;
      console.log('✅ Firebase Admin SDK initialized successfully with service credentials.');
      return;
    } catch (error) {
      console.warn('⚠️ Failed to initialize Firebase Admin SDK with credentials:', error.message);
      isFirebaseInitialized = false;
    }
  } else if (projectId) {
    try {
      firebaseApp = initializeApp({ projectId });
      isFirebaseInitialized = true;
      console.log(`✅ Firebase Admin initialized with Project ID (${projectId}) for token verification.`);
      return;
    } catch (error) {
      console.warn('⚠️ Failed to initialize Firebase Admin with projectId:', error.message);
      isFirebaseInitialized = false;
    }
  } else {
    console.warn(
      '⚠️ Firebase Admin credentials not set (FIREBASE_PROJECT_ID). Running in development fallback mode.'
    );
  }
};


// Auto-run initialization on module load
initializeFirebaseAdmin();

/**
 * Peek at JWT payload without trusting signature (used only to distinguish issuer/mock tokens)
 */
const decodeJwtPayloadUnsafe = (token) => {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payloadBase64 = parts[1].replaceAll('-', '+').replaceAll('_', '/');
    return JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
  } catch {
    return null;
  }
};

/**
 * Verify a Google OAuth2 ID token (mobile @react-native-google-signin) or Firebase Auth ID token (web)
 * @param {string} idToken
 * @returns {Promise<{ uid: string, email: string, name?: string, picture?: string, emailVerified: boolean }>}
 */
export const verifyGoogleIdToken = async (idToken) => {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('A valid Google ID token is required.');
  }

  const unverifiedPayload = decodeJwtPayloadUnsafe(idToken);
  const isMockDevToken =
    process.env.NODE_ENV !== 'production' && idToken.endsWith('.mockSignature');

  // 1. Google OAuth2 ID Token (issued by accounts.google.com, e.g. from React Native GoogleSignin)
  if (
    !isMockDevToken &&
    unverifiedPayload &&
    (unverifiedPayload.iss === 'https://accounts.google.com' ||
      unverifiedPayload.iss === 'accounts.google.com')
  ) {
    try {
      const ticket = await googleOAuthClient.verifyIdToken({
        idToken,
        audience: ALLOWED_GOOGLE_AUDIENCES,
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new Error('Google ID token missing email claim.');
      }
      return {
        uid: payload.sub,
        email: payload.email.toLowerCase().trim(),
        name: payload.name || '',
        picture: payload.picture || '',
        emailVerified: Boolean(payload.email_verified),
      };
    } catch (err) {
      throw new Error(`Invalid Google OAuth ID token: ${err.message}`);
    }
  }

  // 2. Firebase Auth ID Token (issued by securetoken.google.com/<projectId>, e.g. from Web Firebase SDK)
  if (!isMockDevToken && isFirebaseInitialized && firebaseApp) {
    try {
      const decoded = await getAuth(firebaseApp).verifyIdToken(idToken);
      return {
        uid: decoded.uid,
        email: (decoded.email || '').toLowerCase().trim(),
        name: decoded.name || decoded.displayName || '',
        picture: decoded.picture || '',
        emailVerified: Boolean(decoded.email_verified),
      };
    } catch (err) {
      throw new Error(`Invalid Google ID token: ${err.message}`);
    }
  }

  // 3. Graceful fallback / simulation for local development when credentials are not yet configured
  if (process.env.NODE_ENV !== 'production') {
    console.warn('⚠️ Decoding token payload in development fallback mode.');
    if (unverifiedPayload?.email) {
      return {
        uid: unverifiedPayload.uid || unverifiedPayload.sub || `mock_google_${Date.now()}`,
        email: unverifiedPayload.email.toLowerCase().trim(),
        name: unverifiedPayload.name || unverifiedPayload.displayName || 'Google User',
        picture: unverifiedPayload.picture || '',
        emailVerified: true,
      };
    }
    try {
      const json = JSON.parse(idToken);
      if (json.email) {
        return {
          uid: json.uid || `mock_google_${Date.now()}`,
          email: json.email.toLowerCase().trim(),
          name: json.name || 'Google User',
          picture: json.picture || '',
          emailVerified: true,
        };
      }
    } catch {
      // Ignored: Input is neither standard JWT nor valid JSON object
    }
  }

  throw new Error('Could not verify Google ID token. Please configure Firebase credentials.');
};

/**
 * Send push notification to multiple FCM device tokens
 * @param {string[]} fcmTokens
 * @param {{ title: string, body: string, data?: Record<string, string> }} payload
 * @returns {Promise<{ successCount: number, failureCount: number, invalidTokens: string[] }>}
 */
export const sendPushNotification = async (fcmTokens, { title, body, data = {} } = {}) => {
  const tokenList = fcmTokens || [];
  const validTokens = tokenList.filter(
    (t) => typeof t === 'string' && t.trim().length > 0
  );

  if (validTokens.length === 0) {
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  if (isFirebaseInitialized && firebaseApp) {
    try {
      const stringData = {};
      for (const [key, val] of Object.entries(data)) {
        stringData[key] = typeof val === 'string' ? val : JSON.stringify(val);
      }

      const response = await getMessaging(firebaseApp).sendEachForMulticast({
        tokens: validTokens,
        notification: {
          title,
          body,
        },
        data: stringData,
      });

      const invalidTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(validTokens[idx]);
          }
        }
      });

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
        invalidTokens,
      };
    } catch (err) {
      console.error('❌ Error sending FCM push notification:', err.message);
      return { successCount: 0, failureCount: validTokens.length, invalidTokens: [] };
    }
  }

  console.log(
    `[Mock Push Notification] Sent to ${validTokens.length} devices:`,
    { title, body, data }
  );
  return { successCount: validTokens.length, failureCount: 0, invalidTokens: [] };
};

export default {
  verifyGoogleIdToken,
  sendPushNotification,
};
