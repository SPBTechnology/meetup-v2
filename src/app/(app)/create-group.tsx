import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { createConversation } from '../../data/conversations';
import { isDataError } from '../../data/errors';
import { describeDataError } from '../../lib/errorMessages';

export default function CreateGroupScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setSubmitting(true);
    setError(null);
    try {
      const id = await createConversation({ name: name.trim() });
      router.replace(`/conversation/${id}`);
    } catch (err) {
      setError(isDataError(err) ? describeDataError(err.code) : describeDataError('unknown'));
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container} testID="CreateGroup-Screen">
      <View style={styles.header}>
        <Text style={styles.title}>New group</Text>
        <Pressable onPress={() => router.back()} testID="CreateGroup-CancelButton">
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.input}
        testID="CreateGroup-NameInput"
        placeholder="Group name (optional)"
        value={name}
        onChangeText={setName}
        autoFocus
      />

      {error && (
        <Text style={styles.error} testID="CreateGroup-ErrorText">
          {error}
        </Text>
      )}

      <Pressable
        style={[styles.button, submitting && styles.buttonDisabled]}
        onPress={handleCreate}
        disabled={submitting}
        testID="CreateGroup-CreateButton"
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create</Text>}
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
