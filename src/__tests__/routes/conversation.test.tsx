import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';

import ConversationScreen from '../../app/(app)/conversation/[id]';
import { getConversation } from '../../data/conversations';
import { DataError } from '../../data/errors';
import { listMessages, sendMessage, subscribeToMessages } from '../../data/messages';
import { fakeSession, fakeUser } from '../../test-utils/supabaseFixtures';
import { renderRoute } from '../../test-utils/renderRoute';

const mockSessionValue = { session: fakeSession({ user: fakeUser({ id: 'user-1' }) }), loading: false };

jest.mock('../../data/conversations', () => ({
  getConversation: jest.fn(),
}));
jest.mock('../../data/messages', () => ({
  listMessages: jest.fn(),
  sendMessage: jest.fn(),
  subscribeToMessages: jest.fn(() => jest.fn()),
}));
jest.mock('../../hooks/useSession', () => ({ useSession: () => mockSessionValue }));

const mockGetConversation = getConversation as jest.Mock;
const mockListMessages = listMessages as jest.Mock;
const mockSendMessage = sendMessage as jest.Mock;
const mockSubscribeToMessages = subscribeToMessages as jest.Mock;

const MESSAGE_1 = {
  id: 'msg-1',
  conversationId: 'conv-1',
  senderId: 'user-2',
  kind: 'user' as const,
  content: 'Hello',
  createdAt: '2026-01-02T00:00:00Z',
};

async function renderScreen() {
  return renderRoute({ 'conversation/[id]': ConversationScreen }, { initialUrl: '/conversation/conv-1' });
}

describe('conversation route', () => {
  beforeEach(() => {
    mockGetConversation.mockResolvedValue({
      id: 'conv-1',
      type: 'group',
      name: 'Stag do',
      createdBy: 'user-1',
      createdAt: '2026-01-01T00:00:00Z',
      lastMessage: null,
      lastActivityAt: '2026-01-01T00:00:00Z',
    });
    mockListMessages.mockResolvedValue({ messages: [MESSAGE_1], nextCursor: undefined });
    mockSubscribeToMessages.mockReturnValue(jest.fn());
  });

  afterEach(() => jest.clearAllMocks());

  it('loads the conversation title and its messages', async () => {
    await renderScreen();

    await waitFor(() => expect(screen.getByText('Stag do')).toBeOnTheScreen());
    expect(screen.getByText('Hello')).toBeOnTheScreen();
    expect(mockListMessages).toHaveBeenCalledWith('conv-1');
  });

  it('shows a mapped error message when loading messages fails', async () => {
    mockListMessages.mockRejectedValue(new DataError('not_authenticated'));

    await renderScreen();

    await waitFor(() => expect(screen.getByTestId('Conversation-ErrorText')).toBeOnTheScreen());
  });

  it('sends a message and shows it once sent', async () => {
    const sent = { ...MESSAGE_1, id: 'msg-2', senderId: 'user-1', content: 'On my way' };
    mockSendMessage.mockResolvedValue(sent);
    const user = userEvent.setup();

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Hello')).toBeOnTheScreen());

    await user.type(screen.getByTestId('Conversation-MessageInput'), 'On my way');
    await user.press(screen.getByTestId('Conversation-SendButton'));

    await waitFor(() => expect(mockSendMessage).toHaveBeenCalledWith('conv-1', 'user-1', 'On my way'));
    await waitFor(() => expect(screen.getByText('On my way')).toBeOnTheScreen());
    // The input clears optimistically and doesn't reflect the sent text.
    expect(screen.getByTestId('Conversation-MessageInput')).toHaveProp('value', '');
  });

  it('restores the draft and shows an error when sending fails', async () => {
    mockSendMessage.mockRejectedValue(new DataError('not_authenticated'));
    const user = userEvent.setup();

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Hello')).toBeOnTheScreen());

    await user.type(screen.getByTestId('Conversation-MessageInput'), 'On my way');
    await user.press(screen.getByTestId('Conversation-SendButton'));

    await waitFor(() => expect(screen.getByTestId('Conversation-ErrorText')).toBeOnTheScreen());
    expect(screen.getByTestId('Conversation-MessageInput')).toHaveProp('value', 'On my way');
  });

  it('subscribes to new messages and adds them without duplicating an already-sent one', async () => {
    let handler: ((message: typeof MESSAGE_1) => void) | undefined;
    mockSubscribeToMessages.mockImplementation((_id: string, onInsert: (message: typeof MESSAGE_1) => void) => {
      handler = onInsert;
      return jest.fn();
    });

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Hello')).toBeOnTheScreen());
    expect(mockSubscribeToMessages).toHaveBeenCalledWith('conv-1', expect.any(Function));

    const incoming = { ...MESSAGE_1, id: 'msg-3', content: 'Realtime message' };
    handler!(incoming);
    await waitFor(() => expect(screen.getByText('Realtime message')).toBeOnTheScreen());

    // Re-delivering the same id (e.g. the echo of a message this client sent) must not duplicate it.
    const before = screen.getAllByText('Realtime message').length;
    handler!(incoming);
    expect(screen.getAllByText('Realtime message')).toHaveLength(before);
  });

  it('loads the next page of older messages when the list end is reached', async () => {
    const older = { ...MESSAGE_1, id: 'msg-0', content: 'Older message', createdAt: '2025-12-31T00:00:00Z' };
    mockListMessages.mockResolvedValueOnce({
      messages: [MESSAGE_1],
      nextCursor: { createdAt: MESSAGE_1.createdAt, id: MESSAGE_1.id },
    });
    mockListMessages.mockResolvedValueOnce({ messages: [older], nextCursor: undefined });

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Hello')).toBeOnTheScreen());

    fireEvent(screen.getByTestId('Conversation-MessageList'), 'endReached');

    await waitFor(() =>
      expect(mockListMessages).toHaveBeenCalledWith('conv-1', {
        before: { createdAt: MESSAGE_1.createdAt, id: MESSAGE_1.id },
      }),
    );
    await waitFor(() => expect(screen.getByText('Older message')).toBeOnTheScreen());
    await waitFor(() => expect(screen.queryByTestId('Conversation-LoadingMore')).not.toBeOnTheScreen());
  });

  it('navigates to invite with the conversation id when Invite is pressed', async () => {
    const user = userEvent.setup();

    const testRouter = await renderRoute(
      { 'conversation/[id]': ConversationScreen, invite: () => null },
      { initialUrl: '/conversation/conv-1' },
    );
    await waitFor(() => expect(screen.getByText('Hello')).toBeOnTheScreen());

    await user.press(screen.getByTestId('Conversation-InviteButton'));

    await waitFor(() => expect(testRouter.getPathnameWithParams()).toBe('/invite?conversationId=conv-1'));
  });
});
