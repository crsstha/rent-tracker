/**
 * Firebase configuration — read, validated, and otherwise untouched.
 *
 * Nothing here calls the SDK. `initializeApp` is deliberately absent so that
 * building or running the app with no Firebase project configured cannot fail:
 * the keys are collected, and the adapter that would use them is a stub until
 * someone follows FIREBASE_INTEGRATION.md.
 */

export interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

export function readFirebaseConfig(): Partial<FirebaseConfig> {
  const env = import.meta.env
  return {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  }
}

const REQUIRED_KEYS: (keyof FirebaseConfig)[] = ['apiKey', 'authDomain', 'projectId', 'appId']

/** True only when every key the SDK needs is present and non-empty. */
export function isFirebaseConfigured(config = readFirebaseConfig()): config is FirebaseConfig {
  return REQUIRED_KEYS.every((key) => Boolean(config[key]))
}

/** Collection names, kept here so both adapters agree on the wire format. */
export const COLLECTIONS = {
  houses: 'houses',
  tenants: 'tenants',
} as const
