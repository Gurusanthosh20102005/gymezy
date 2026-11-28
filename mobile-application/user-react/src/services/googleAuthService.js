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
    return Boolean(turboModule || legacyModule);
  } catch {
    return false;
  }
};

const getGoogleSignin = () => {
  if (GoogleSigninModule) return GoogleSigninModule;
  if (!isGoogleNativeModuleAvailable()) return null;

  try {
    const mod = require('@react-native-google-signin/google-signin');
    GoogleSigninModule = {
      GoogleSignin: mod.GoogleSignin,
      statusCodes: mod.statusCodes,
    };
    return GoogleSigninModule;
  } catch (err) {
    console.warn('[GOOGLE AUTH] Could not load @react-native-google-signin/google-signin:', err.message);
    return null;
  }
};

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
      console.warn('[GOOGLE AUTH] configure error:', err.message);
    }
  }
};

export const signInWithGoogle = async () => {
  const sdk = getGoogleSignin();

  if (!sdk || !sdk.GoogleSignin) {
    if (__DEV__) {
      console.warn(
        '[GOOGLE AUTH] RNGoogleSignin native module is not registered in this Expo/APK binary. Using development simulated sign-in.'
      );
      return simulateDevGoogleLogin();
    }
    throw new Error(
      'Google Sign-In is unavailable in this build. Please update or reinstall the app.'
    );
  }

  configureGoogleSignIn();

  try {
    await sdk.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await sdk.GoogleSignin.signIn();

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
    }
    if (statusCodes && error.code === statusCodes.IN_PROGRESS) {
      throw new Error('Google Sign-In is already in progress.');
    }
    if (statusCodes && error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      if (__DEV__) {
        return simulateDevGoogleLogin();
      }
      throw new Error('Google Play Services is not available or needs an update.');
    }

    if (
      __DEV__ &&
      (error.code === 'DEVELOPER_ERROR' ||
        error.message?.includes('DEVELOPER_ERROR') ||
        error.code === '10')
    ) {
      console.warn('[GOOGLE AUTH] DEVELOPER_ERROR in dev mode. Using simulated Google account.');
      return simulateDevGoogleLogin();
    }

    throw error;
  }
};

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

const toBase64 = (str) => {
  try {
    if (typeof btoa === 'function') return btoa(str);
  } catch {}
  try {
    if (typeof Buffer !== 'undefined') return Buffer.from(str).toString('base64');
  } catch {}
  return '';
};

const simulateDevGoogleLogin = () => {
  return new Promise((resolve, reject) => {
    const defaultEmail = 'sam@gmail.com';
    const buildToken = (email) => {
      const cleanEmail = email.trim().toLowerCase();
      const rawName = cleanEmail.split('@')[0].replace(/[._]/g, ' ');
      const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
      const mockPayload = {
        sub: `mock_google_dev_${Date.now()}`,
        email: cleanEmail,
        name: formattedName,
        picture: 'https://lh3.googleusercontent.com/a/default-user',
      };
      const header = toBase64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
      const payload = toBase64(JSON.stringify(mockPayload));
      return {
        idToken: `${header}.${payload}.mockSignature`,
        user: {
          id: mockPayload.sub,
          email: cleanEmail,
          name: formattedName,
          photo: mockPayload.picture,
        },
      };
    };

    if (Platform.OS === 'ios' && Alert.prompt) {
      Alert.prompt(
        'Dev Mode - Google Sign-In',
        'Enter Google email to simulate Member Sign-In:',
        [
          {
            text: 'Cancel',
            onPress: () => reject(new Error('Google Sign-In was cancelled.')),
            style: 'cancel',
          },
          {
            text: 'Sign In',
            onPress: (inputEmail) => resolve(buildToken(inputEmail || defaultEmail)),
          },
        ],
        'plain-text',
        defaultEmail
      );
    } else {
      Alert.alert(
        'Dev Mode - Google Sign-In',
        `Native Google Sign-In is unavailable in Expo Go.\n\nContinue with simulated member account (${defaultEmail})?`,
        [
          {
            text: 'Cancel',
            onPress: () => reject(new Error('Google Sign-In was cancelled.')),
            style: 'cancel',
          },
          {
            text: 'Continue',
            onPress: () => resolve(buildToken(defaultEmail)),
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
