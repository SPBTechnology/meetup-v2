import { useCallback, useState } from 'react';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { listConversations, type ConversationSummary } from '../../data/conversations';
import { isDataError } from '../../data/errors';
import { describeDataError } from '../../lib/errorMessages';

function conversationTitle(conversation: ConversationSummary): string {
  return conversation.name ?? 'Unnamed group';
}

export default function HomeScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refetches every time the screen regains focus (returning from creating a
  // group, or from a conversation whose last message just changed) rather
  // than only on mount, since this screen stays mounted underneath those.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError(null);

      listConversations()
        .then((result) => {
          if (active) setConversations(result);
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
    }, []),
  );

  return (
    <View style={styles.container} testID="Home-Screen">
      <View style={styles.header}>
        <Text style={styles.title}>MeetUp</Text>
        <Link href="/profile" style={styles.link} testID="Home-ProfileLink">
          Profile
        </Link>
      </View>

      {error && (
        <Text style={styles.error} testID="Home-ErrorText">
          {error}
        </Text>
      )}

      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" testID="Home-Loading" style={styles.loading} />
        ) : conversations.length === 0 ? (
          <Text style={styles.empty} testID="Home-EmptyText">
            No conversations yet. Start one below.
          </Text>
        ) : (
          <FlatList
            testID="Home-ConversationList"
            data={conversations}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                style={styles.row}
                testID={`Home-Conversation-${item.id}`}
                onPress={() => router.push(`/conversation/${item.id}`)}
              >
                <Text style={styles.rowTitle}>{conversationTitle(item)}</Text>
                <Text style={styles.rowPreview} numberOfLines={1}>
                  {item.lastMessage ? item.lastMessage.content : 'No messages yet'}
                </Text>
              </Pressable>
            )}
          />
        )}
      </View>

      <Pressable style={styles.newButton} onPress={() => router.push('/create-group')} testID="Home-NewGroupButton">
        <Text style={styles.newButtonText}>New group</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  link: {
    fontSize: 16,
    color: '#2563eb',
  },
  error: {
    color: '#dc2626',
    fontSize: 14,
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  content: {
    flex: 1,
  },
  loading: {
    marginTop: 24,
  },
  empty: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 24,
  },
  row: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 4,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowPreview: {
    fontSize: 14,
    color: '#6b7280',
  },
  newButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 24,
    marginVertical: 16,
  },
  newButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
