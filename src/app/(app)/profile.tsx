import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { getProfile, signOut, updateProfile } from '../../data/auth';
import { isDataError } from '../../data/errors';
import { describeDataError } from '../../lib/errorMessages';
import { useSession } from '../../hooks/useSession';

export default function ProfileScreen() {
  const { session } = useSession();
  const userId = session?.user.id;

  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    getProfile(userId)
      .then((profile) => {
        if (!active) return;
        setDisplayName(profile.displayName);
        setPhoneNumber(profile.phoneNumber ?? '');
      })
      .catch((err: unknown) => {
        if (active) setError(isDataError(err) ? describeDataError(err.code) : describeDataError('unknown'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId]);

  async function handleSave() {
    if (!userId) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateProfile(userId, {
        displayName: displayName.trim(),
        phoneNumber: phoneNumber.trim() === '' ? null : phoneNumber.trim(),
      });
      setSaved(true);
    } catch (err) {
      setError(isDataError(err) ? describeDataError(err.code) : describeDataError('unknown'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center} testID="Profile-Screen">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="Profile-Screen">
      <Text style={styles.label}>Display name</Text>
      <TextInput
        style={styles.input}
        testID="Profile-DisplayNameInput"
        value={displayName}
        onChangeText={(text) => {
          setDisplayName(text);
          setSaved(false);
        }}
      />

      <Text style={styles.label}>Phone number</Text>
      <TextInput
        style={styles.input}
        testID="Profile-PhoneNumberInput"
        value={phoneNumber}
        onChangeText={(text) => {
          setPhoneNumber(text);
          setSaved(false);
        }}
        placeholder="+447700900123"
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
      />

      {error && (
        <Text style={styles.error} testID="Profile-ErrorText">
          {error}
        </Text>
      )}
      {saved && !error && (
        <Text style={styles.success} testID="Profile-SavedText">
          Saved.
        </Text>
      )}

      <Pressable
        style={[styles.button, saving && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={saving}
        testID="Profile-SaveButton"
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save</Text>}
      </Pressable>

      <Pressable
        style={styles.signOutButton}
        onPress={() => {
          void signOut();
        }}
        testID="Profile-SignOutButton"
      >
        <Text style={styles.signOutText}>Sign out</Text>
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
    gap: 8,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
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
    marginTop: 8,
  },
  success: {
    color: '#16a34a',
    fontSize: 14,
    marginTop: 8,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 24,
  },
  signOutText: {
    color: '#dc2626',
    fontSize: 16,
  },
});
