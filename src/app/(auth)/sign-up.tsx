import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { signUp } from '../../data/auth';
import { isDataError } from '../../data/errors';
import { describeDataError } from '../../lib/errorMessages';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only reached if email confirmation is ever turned on (off in local dev —
  // see supabase/config.toml). With it on, signUp returns no session and the
  // root layout has nothing to swap to, so this screen must say so itself.
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await signUp(email.trim(), password);
      if (!result.signedIn) setNeedsConfirmation(true);
      // Otherwise: useSession() picks up the new session and the root layout
      // swaps to the (app) stack — no manual navigation needed here.
    } catch (err) {
      setError(isDataError(err) ? describeDataError(err.code) : describeDataError('unknown'));
    } finally {
      setSubmitting(false);
    }
  }

  if (needsConfirmation) {
    return (
      <View style={styles.container} testID="SignUp-Screen">
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.info} testID="SignUp-ConfirmEmailText">
          We’ve sent a confirmation link to {email.trim()}. Follow it, then come back and sign in.
        </Text>
        <Link href="/sign-in" style={styles.link} testID="SignUp-BackToSignInLink">
          Back to sign in
        </Link>
      </View>
    );
  }

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  return (
    <View style={styles.container} testID="SignUp-Screen">
      <Text style={styles.title}>Create an account</Text>

      <TextInput
        style={styles.input}
        testID="SignUp-EmailInput"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
      />
      <TextInput
        style={styles.input}
        testID="SignUp-PasswordInput"
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="newPassword"
        autoComplete="password-new"
      />

      {error && (
        <Text style={styles.error} testID="SignUp-ErrorText">
          {error}
        </Text>
      )}

      <Pressable
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
        testID="SignUp-SubmitButton"
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign up</Text>}
      </Pressable>

      <Link href="/sign-in" style={styles.link} testID="SignUp-SignInLink">
        Already have an account? Sign in
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  info: {
    fontSize: 16,
    textAlign: 'center',
    color: '#374151',
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
  link: {
    marginTop: 16,
    textAlign: 'center',
    color: '#2563eb',
    fontSize: 14,
  },
});
