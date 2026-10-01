import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { isDataError } from '../../data/errors';
import { acceptInvite } from '../../data/invites';
import { describeDataError } from '../../lib/errorMessages';

export default function JoinScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    const trimmed = code.trim();
    if (trimmed === '') return;
    setSubmitting(true);
    setError(null);
    try {
      const conversationId = await acceptInvite(trimmed);
      router.replace(`/conversation/${conversationId}`);
    } catch (err) {
      setError(isDataError(err) ? describeDataError(err.code) : describeDataError('unknown'));
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container} testID="Join-Screen">
      <View style={styles.header}>
        <Text style={styles.title}>Join a group</Text>
        <Pressable onPress={() => router.back()} testID="Join-CancelButton">
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.input}
        testID="Join-CodeInput"
        placeholder="Invite code"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoFocus
      />

      {error && (
        <Text style={styles.error} testID="Join-ErrorText">
          {error}
        </Text>
      )}

      <Pressable
        style={[styles.button, (submitting || code.trim() === '') && styles.buttonDisabled]}
        onPress={handleJoin}
        disabled={submitting || code.trim() === ''}
        testID="Join-SubmitButton"
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Join</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  cancel: {
    fontSize: 16,
    color: '#2563eb',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    letterSpacing: 1,
  },
  error: {
    color: '#dc2626',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
