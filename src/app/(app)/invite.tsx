import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Contact, ContactField, requestPermissionsAsync } from 'expo-contacts';
import * as SMS from 'expo-sms';
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { addParticipants } from '../../data/conversations';
import { isDataError } from '../../data/errors';
import { getOrCreateActiveInvite, matchPhoneNumbers, type Invite, type PhoneMatch } from '../../data/invites';
import { useSession } from '../../hooks/useSession';
import { describeDataError } from '../../lib/errorMessages';
import { formatInviteCode } from '../../lib/inviteCode';
import { normalizeToE164 } from '../../lib/phoneNumber';

type MatchedContact = PhoneMatch & { contactName: string };
type UnmatchedContact = { phoneNumber: string; contactName: string };
type ContactsState = 'idle' | 'loading' | 'denied' | 'loaded';

export default function InviteScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;

  const [invite, setInvite] = useState<Invite | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [contactsState, setContactsState] = useState<ContactsState>('idle');
  const [matched, setMatched] = useState<MatchedContact[]>([]);
  const [unmatched, setUnmatched] = useState<UnmatchedContact[]>([]);
  const [addedUserIds, setAddedUserIds] = useState<Set<string>>(new Set());
  const [addingUserId, setAddingUserId] = useState<string | null>(null);
  const [contactsError, setContactsError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    getOrCreateActiveInvite(conversationId, userId)
      .then((result) => {
        if (active) setInvite(result);
      })
      .catch((err: unknown) => {
        if (active) setInviteError(isDataError(err) ? describeDataError(err.code) : describeDataError('unknown'));
      })
      .finally(() => {
        if (active) setLoadingInvite(false);
      });

    return () => {
      active = false;
    };
  }, [conversationId, userId]);

  function inviteMessage(): string {
    return `Join my MeetUp group! Open the app and enter this code: ${invite ? formatInviteCode(invite.code) : ''}`;
  }

  async function handleShare() {
    if (!invite) return;
    await Share.share({ message: inviteMessage() });
  }

  async function handleFindContacts() {
    setContactsState('loading');
    setContactsError(null);
    try {
      const { status } = await requestPermissionsAsync();
      if (status !== 'granted') {
        setContactsState('denied');
        return;
      }

      const details = await Contact.getAllDetails([ContactField.FULL_NAME, ContactField.PHONES]);
      const nameByNumber = new Map<string, string>();
      for (const contact of details) {
        for (const phone of contact.phones ?? []) {
          if (!phone.number) continue;
          const normalized = normalizeToE164(phone.number);
          // First contact wins a given number; later duplicates are skipped.
          if (!normalized || nameByNumber.has(normalized)) continue;
          nameByNumber.set(normalized, contact.fullName ?? 'Unknown');
        }
      }

      const numbers = [...nameByNumber.keys()];
      const matches = numbers.length > 0 ? await matchPhoneNumbers(numbers) : [];
      const matchedNumbers = new Set(matches.map((m) => m.phoneNumber));

      setMatched(matches.map((m) => ({ ...m, contactName: nameByNumber.get(m.phoneNumber) ?? m.displayName })));
      setUnmatched(
        numbers.filter((n) => !matchedNumbers.has(n)).map((n) => ({ phoneNumber: n, contactName: nameByNumber.get(n)! })),
      );
      setContactsState('loaded');
    } catch (err) {
      setContactsError(isDataError(err) ? describeDataError(err.code) : describeDataError('unknown'));
      setContactsState('idle');
    }
  }

  async function handleAdd(userIdToAdd: string) {
    setAddingUserId(userIdToAdd);
    setContactsError(null);
    try {
      await addParticipants(conversationId, [userIdToAdd]);
      setAddedUserIds((prev) => new Set(prev).add(userIdToAdd));
    } catch (err) {
      setContactsError(isDataError(err) ? describeDataError(err.code) : describeDataError('unknown'));
    } finally {
      setAddingUserId(null);
    }
  }

  async function handleTextInvite(phoneNumber: string) {
    setContactsError(null);
    try {
      const available = await SMS.isAvailableAsync();
      if (!available) {
        setContactsError('Texting is not available on this device.');
        return;
      }
      await SMS.sendSMSAsync([phoneNumber], inviteMessage());
    } catch {
      setContactsError('Could not open the messaging app.');
    }
  }

  return (
    <View style={styles.container} testID="Invite-Screen">
      <View style={styles.header}>
        <Text style={styles.title}>Invite people</Text>
        <Pressable onPress={() => router.back()} testID="Invite-CloseButton">
          <Text style={styles.close}>Close</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Share a code</Text>
        {inviteError && (
          <Text style={styles.error} testID="Invite-ErrorText">
            {inviteError}
          </Text>
        )}
        {loadingInvite ? (
          <ActivityIndicator testID="Invite-Loading" />
        ) : (
          invite && (
            <>
              <Text style={styles.code} testID="Invite-Code">
                {formatInviteCode(invite.code)}
              </Text>
              <Pressable style={styles.button} onPress={handleShare} testID="Invite-ShareButton">
                <Text style={styles.buttonText}>Share</Text>
              </Pressable>
            </>
          )
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Find friends in your contacts</Text>
        {contactsError && (
          <Text style={styles.error} testID="Invite-ContactsErrorText">
            {contactsError}
          </Text>
        )}

        {contactsState === 'idle' && (
          <Pressable style={styles.button} onPress={handleFindContacts} testID="Invite-FindContactsButton">
            <Text style={styles.buttonText}>Find friends</Text>
          </Pressable>
        )}
        {contactsState === 'loading' && <ActivityIndicator testID="Invite-ContactsLoading" />}
        {contactsState === 'denied' && (
          <Text style={styles.hint} testID="Invite-ContactsDeniedText">
            MeetUp needs permission to access your contacts to find friends who already use the app.
          </Text>
        )}
        {contactsState === 'loaded' && (
          <>
            {matched.length === 0 && unmatched.length === 0 && (
              <Text style={styles.hint} testID="Invite-ContactsEmptyText">
                No contacts with phone numbers found.
              </Text>
            )}
            {matched.map((contact) => {
              const added = addedUserIds.has(contact.userId);
              return (
                <View style={styles.row} key={contact.userId} testID={`Invite-Matched-${contact.userId}`}>
                  <Text style={styles.rowName}>{contact.contactName}</Text>
                  <Pressable
                    style={[styles.smallButton, added && styles.smallButtonDisabled]}
                    onPress={() => handleAdd(contact.userId)}
                    disabled={added || addingUserId === contact.userId}
                    testID={`Invite-AddButton-${contact.userId}`}
                  >
                    {addingUserId === contact.userId ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.smallButtonText}>{added ? 'Added' : 'Add'}</Text>
                    )}
                  </Pressable>
                </View>
              );
            })}
            {unmatched.map((contact) => (
              <View style={styles.row} key={contact.phoneNumber} testID={`Invite-Unmatched-${contact.phoneNumber}`}>
                <Text style={styles.rowName}>{contact.contactName}</Text>
                <Pressable
                  style={styles.smallButton}
                  onPress={() => handleTextInvite(contact.phoneNumber)}
                  testID={`Invite-TextButton-${contact.phoneNumber}`}
                >
                  <Text style={styles.smallButtonText}>Text</Text>
                </Pressable>
              </View>
            ))}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  close: {
    fontSize: 16,
    color: '#2563eb',
  },
  section: {
    marginBottom: 28,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  error: {
    color: '#dc2626',
    fontSize: 14,
  },
  hint: {
    fontSize: 14,
    color: '#6b7280',
  },
  code: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 2,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rowName: {
    fontSize: 15,
    flex: 1,
  },
  smallButton: {
    backgroundColor: '#2563eb',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 14,
    minWidth: 64,
    alignItems: 'center',
  },
  smallButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  smallButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
