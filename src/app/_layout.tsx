import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { SessionProvider, useSession } from '../hooks/useSession';

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="auto" />
      <RootNavigator />
    </SessionProvider>
  );
}

// Split out so useSession() runs inside the provider it reads from.
// Stack.Protected keeps both branches always defined (per Expo Router's
// current auth guidance) and swaps between them as `session` changes —
// including automatically, right after a successful sign-in/sign-up,
// because useSession() is subscribed to onAuthStateChange.
function RootNavigator() {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <View style={styles.center} testID="App-Loading">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={session !== null}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>

      <Stack.Protected guard={session === null}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
});
