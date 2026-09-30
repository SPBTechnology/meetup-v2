import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

// Placeholder home route. Replaced by the conversation list in Phase 3.
export default function HomeScreen() {
  return (
    <View style={styles.container} testID="Home-Screen">
      <Text style={styles.title}>MeetUp</Text>
      <Link href="/profile" style={styles.link} testID="Home-ProfileLink">
        Profile
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  link: {
    fontSize: 16,
    color: '#2563eb',
  },
});
