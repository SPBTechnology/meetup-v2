import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="create-group" options={{ presentation: 'modal' }} />
      <Stack.Screen name="invite" options={{ presentation: 'modal' }} />
      <Stack.Screen name="join" options={{ presentation: 'modal' }} />
      <Stack.Screen name="event/create" options={{ presentation: 'modal' }} />
      <Stack.Screen name="event/[id]" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
