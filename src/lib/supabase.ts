// The only place (besides src/data/) that may import '@supabase/supabase-js'.
// Enforced by eslint.config.js. See ADR 0002 (Supabase Auth) and
// docs/context/conventions.md for why this file looks the way it does.
import 'expo-sqlite/localStorage/install';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';

import type { Database } from '../types/database.types';

// expo-sqlite/localStorage/install polyfills the global `localStorage` with a
// SQLite-backed implementation (no-op on web, excluded from web bundles) —
// Expo's own current guidance for Supabase, in preference to AsyncStorage:
// no extra native dependency, works with the New Architecture, and offers a
// synchronous API path if ever needed. See docs/context/conventions.md.
//
// Not encrypted at rest. Acceptable for MVP data (no payment details, no
// health data); revisit with expo-secure-store if that changes — see
// docs/context/data-model.md "Known limits".

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY are not set. ' +
      'Run `npm run setup` to generate .env from the local Supabase stack.',
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Android/iOS have no URL to read a session from (that's a web-only flow).
    detectSessionInUrl: false,
  },
});

// autoRefreshToken runs its refresh loop continuously, including while the
// app is backgrounded, unless told otherwise. Start/stop it with app state
// so a backgrounded app doesn't keep waking the radio to refresh a token
// nobody is using.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
