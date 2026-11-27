import { Alert, NativeModules, Platform, TurboModuleRegistry } from 'react-native';

// Google OAuth Web Client ID matching Firebase Project (gymezy-1fb31 / 1090454074390)
export const GOOGLE_WEB_CLIENT_ID =
  '1090454074390-i0unlvauvvkntq6kt01vf5ljaaql35pj.apps.googleusercontent.com';

let isConfigured = false;
let GoogleSigninModule = null;

/**
 * Safely check if the native Android/iOS module for GoogleSignin is registered
 * in the currently running binary (without throwing TurboModule invariant errors).
 */
export const isGoogleNativeModuleAvailable = () => {
  try {
    const turboModule =
      typeof TurboModuleRegistry?.get === 'function'
        ? TurboModuleRegistry.get('RNGoogleSignin')
        : null;
    const legacyModule = NativeModules?.RNGoogleSignin;
    return !!(turboModule || legacyModule);
  } catch {
    return false;
  }
};

/**
 * Lazy-load the native @react-native-google-signin/google-signin package only
 * if the native module exists in the running binary.
 */
const getGoogleSignin = () => {
  if (GoogleSigninModule) return GoogleSigninModule;

  if (!isGoogleNativeModuleAvailable()) {
    return null;
  }

  try {
    const mod = require('@react-native-google-signin/google-signin');
    GoogleSigninModule = {
      GoogleSignin: mod.GoogleSignin,
      statusCodes: mod.statusCodes,
    };
    return GoogleSigninModule;
  } catch (err) {
    console.warn('⚠️ Could not load @react-native-google-signin/google-signin:', err.message);
    return null;
  }
};

/**
 * Configure Google Sign-In SDK
 */
export const configureGoogleSignIn = () => {
  if (isConfigured) return;

  const sdk = getGoogleSignin();
  if (sdk?.GoogleSignin) {
    try {
      sdk.GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
        offlineAccess: false,
        scopes: ['profile', 'email'],
      });
      isConfigured = true;
    } catch (err) {
      console.warn('⚠️ GoogleSignin.configure error:', err.message);
    }
  }
};

/**
 * Initiates the Google Sign-In native flow
 * @returns {Promise<{ idToken: string, user: { email: string, name: string, photo: string, id: string } }>}
 */
export const signInWithGoogle = async () => {
  const sdk = getGoogleSignin();

  // If the currently running APK has not been recompiled since adding the native library
  if (!sdk || !sdk.GoogleSignin) {
    if (__DEV__) {
      console.warn(
        '⚠️ RNGoogleSignin native module is not registered in the currently running APK.\n' +
        'Because a new native dependency was added, please rebuild the app (e.g. npm run android or ./gradlew assembleDebug) so Gradle compiles the native binary.\n' +
        'Using development simulated sign-in for testing.'
      );
      return simulateDevGoogleLogin();
    }
    throw new Error(
      'Google Sign-In native module is not registered in this binary. Please rebuild and reinstall the app.'
    );
  }

  configureGoogleSignIn();

  try {
    await sdk.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await sdk.GoogleSignin.signIn();

    // Support both modern { data: { idToken, user } } and legacy { idToken, user } response structures
    const idToken = response?.data?.idToken || response?.idToken;
    const user = response?.data?.user || response?.user;

    if (!idToken) {
      const tokens = await sdk.GoogleSignin.getTokens();
      if (tokens?.idToken) {
        return {
          idToken: tokens.idToken,
          user: user || {},
        };
      }
      throw new Error('Google Sign-In did not return an ID token.');
    }

    return {
      idToken,
      user: {
        id: user?.id || '',
        email: user?.email || '',
        name: user?.name || '',
        photo: user?.photo || '',
      },
    };
  } catch (error) {
    const statusCodes = sdk.statusCodes;
    if (statusCodes && error.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error('Google Sign-In was cancelled.');
    } else if (statusCodes && error.code === statusCodes.IN_PROGRESS) {
      throw new Error('Google Sign-In is already in progress.');
    } else if (statusCodes && error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      if (__DEV__) {
        console.warn('⚠️ Google Play Services not available. Using development simulator.');
        return simulateDevGoogleLogin();
      }
      throw new Error('Google Play Services is not available or needs an update.');
    }

    // In dev mode, if native config/keystore SHA-1 isn't configured for debug keystore, provide fallback simulator
    if (
      __DEV__ &&
      (error.code === 'DEVELOPER_ERROR' ||
        error.message?.includes('DEVELOPER_ERROR') ||
        error.code === '10')
    ) {
      console.warn(
        '⚠️ Google Sign-In DEVELOPER_ERROR in dev mode. Providing simulated Google account for development.'
      );
      return simulateDevGoogleLogin();
    }

    throw error;
  }
};

/**
 * Sign out of Google session
 */
export const signOutGoogle = async () => {
  const sdk = getGoogleSignin();
  if (sdk?.GoogleSignin) {
    try {
      configureGoogleSignIn();
      await sdk.GoogleSignin.signOut();
    } catch {
      // Ignore error
    }
  }
};

/**
 * Safe base64 encode helper
 */
const toBase64 = (str) => {
  try {
    if (typeof btoa === 'function') return btoa(str);
  } catch {}
  try {
    if (typeof Buffer !== 'undefined') return Buffer.from(str).toString('base64');
  } catch {}
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  for (
    let block = 0, charCode, idx = 0, map = chars;
    str.charAt(idx | 0) || ((map = '='), idx % 1);
    output += map.charAt(63 & (block >> (8 - (idx % 1) * 8)))
  ) {
    charCode = str.charCodeAt((idx += 3 / 4));
    block = (block << 8) | charCode;
  }
  return output;
};

/**
 * Development Simulation Fallback (matches web-application/gym-owner/src/config/firebase.js fallback)
 */
const simulateDevGoogleLogin = () => {
  return new Promise((resolve, reject) => {
    const email = 'owner@gymezy.com';
    const mockPayload = {
      sub: `mock_google_dev_${Date.now()}`,
      email,
      name: 'Gym Partner',
      picture: 'https://lh3.googleusercontent.com/a/default-user',
    };
    const header = toBase64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = toBase64(JSON.stringify(mockPayload));
    const mockIdToken = `${header}.${payload}.mockSignature`;

    if (Platform.OS === 'ios' && Alert.prompt) {
      Alert.prompt(
        'Dev Mode - Google Sign-In',
        'Enter Google email to simulate Partner Sign-In:',
        [
          {
            text: 'Cancel',
            onPress: () => reject(new Error('Google Sign-In was cancelled.')),
            style: 'cancel',
          },
          {
            text: 'Sign In',
            onPress: (inputEmail) => {
              const userEmail = (inputEmail || email).trim().toLowerCase();
              const name = userEmail.split('@')[0].replace(/[._]/g, ' ');
              const formattedName = name.charAt(0).toUpperCase() + name.slice(1);
              const customPayload = {
                ...mockPayload,
                email: userEmail,
                name: formattedName,
              };
              const customPayloadB64 = toBase64(JSON.stringify(customPayload));
              resolve({
                idToken: `${header}.${customPayloadB64}.mockSignature`,
                user: {
                  id: customPayload.sub,
                  email: userEmail,
                  name: formattedName,
                  photo: customPayload.picture,
                },
              });
            },
          },
        ],
        'plain-text',
        email
      );
    } else {
      Alert.alert(
        'Dev Mode - Google Sign-In',
        `Native Google Sign-In returned DEVELOPER_ERROR (SHA-1 not yet registered in Firebase).\n\nContinue with simulated partner account (${email})?`,
        [
          {
            text: 'Cancel',
            onPress: () => reject(new Error('Google Sign-In was cancelled.')),
            style: 'cancel',
          },
          {
            text: 'Continue',
            onPress: () =>
              resolve({
                idToken: mockIdToken,
                user: {
                  id: mockPayload.sub,
                  email,
                  name: 'Gym Partner',
                  photo: mockPayload.picture,
                },
              }),
          },
        ],
        {
          cancelable: true,
          onDismiss: () => reject(new Error('Google Sign-In was cancelled.')),
        }
      );
    }
  });
};
