import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { getConversation } from '../../../data/conversations';
import { isDataError } from '../../../data/errors';
import { listMessages, sendMessage, subscribeToMessages, type Message } from '../../../data/messages';
import { useSession } from '../../../hooks/useSession';
import { describeDataError } from '../../../lib/errorMessages';

type Cursor = { createdAt: string; id: string } | undefined;

function addMessageIfNew(messages: Message[], message: Message): Message[] {
  if (messages.some((m) => m.id === message.id)) return messages;
  // Newest-first, matching listMessages — a new message is always the newest.
  return [message, ...messages];
}

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;

  const [title, setTitle] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [nextCursor, setNextCursor] = useState<Cursor>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;

    getConversation(id)
      .then((conversation) => {
        if (active) setTitle(conversation.name ?? 'Unnamed group');
      })
      .catch(() => undefined); // The message list's own error covers a denied/missing conversation.

    listMessages(id)
      .then((page) => {
        if (!active) return;
        setMessages(page.messages);
        setNextCursor(page.nextCursor);
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
  }, [id]);

  useEffect(() => {
    const unsubscribe = subscribeToMessages(id, (message) => {
      setMessages((prev) => addMessageIfNew(prev, message));
    });
    return unsubscribe;
  }, [id]);

  const loadMore = useCallback(() => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    listMessages(id, { before: nextCursor })
      .then((page) => {
        setMessages((prev) => [...prev, ...page.messages]);
        setNextCursor(page.nextCursor);
      })
      .catch(() => undefined) // Leave the loaded page visible; the user can retry by scrolling again.
      .finally(() => setLoadingMore(false));
  }, [id, nextCursor, loadingMore]);

  async function handleSend() {
    const content = text.trim();
    if (!userId || content === '' || sending) return;
    setSending(true);
    setText('');
    try {
      const message = await sendMessage(id, userId, content);
      setMessages((prev) => addMessageIfNew(prev, message));
    } catch (err) {
      setError(isDataError(err) ? describeDataError(err.code) : describeDataError('unknown'));
      setText(content);
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.container} testID="Conversation-Screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="Conversation-BackButton">
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {error && (
        <Text style={styles.error} testID="Conversation-ErrorText">
          {error}
        </Text>
      )}

      {loading ? (
        <ActivityIndicator size="large" testID="Conversation-Loading" style={styles.loading} />
      ) : (
        <FlatList
          testID="Conversation-MessageList"
          style={styles.list}
          data={messages}
          keyExtractor={(item) => item.id}
          inverted
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator testID="Conversation-LoadingMore" style={styles.loadingMore} /> : null
          }
          renderItem={({ item }) => {
            const own = item.senderId === userId;
            return (
              <View style={[styles.bubbleRow, own && styles.bubbleRowOwn]} testID={`Conversation-Message-${item.id}`}>
                <View style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleOther]}>
                  <Text style={own ? styles.bubbleTextOwn : styles.bubbleTextOther}>{item.content}</Text>
                </View>
              </View>
            );
          }}
        />
      )}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          testID="Conversation-MessageInput"
          placeholder="Message"
          value={text}
          onChangeText={setText}
          multiline
        />
        <Pressable
          style={[styles.sendButton, (sending || text.trim() === '') && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={sending || text.trim() === ''}
          testID="Conversation-SendButton"
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  back: {
    fontSize: 16,
    color: '#2563eb',
  },
  headerSpacer: {
    width: 40,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  error: {
    color: '#dc2626',
    fontSize: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  loading: {
    marginTop: 24,
  },
  loadingMore: {
    marginVertical: 12,
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  bubbleRow: {
    marginVertical: 4,
    alignItems: 'flex-start',
  },
  bubbleRowOwn: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleOwn: {
    backgroundColor: '#2563eb',
  },
  bubbleOther: {
    backgroundColor: '#f3f4f6',
  },
  bubbleTextOwn: {
    color: '#fff',
    fontSize: 15,
  },
  bubbleTextOther: {
    color: '#111827',
    fontSize: 15,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 120,
  },
  sendButton: {
    backgroundColor: '#2563eb',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
