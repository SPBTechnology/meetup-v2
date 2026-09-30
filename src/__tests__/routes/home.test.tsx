import { screen, userEvent, waitFor } from '@testing-library/react-native';

import HomeScreen from '../../app/(app)/index';
import { listConversations } from '../../data/conversations';
import { DataError } from '../../data/errors';
import { renderRoute } from '../../test-utils/renderRoute';

jest.mock('../../data/conversations', () => ({
  listConversations: jest.fn(),
}));

const mockListConversations = listConversations as jest.Mock;

const CONVERSATION = {
  id: 'conv-1',
  type: 'group' as const,
  name: 'Stag do',
  createdBy: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
  lastMessage: { id: 'msg-1', content: 'See you there!', senderId: 'user-2', createdAt: '2026-01-02T00:00:00Z' },
  lastActivityAt: '2026-01-02T00:00:00Z',
};

describe('home route', () => {
  afterEach(() => jest.clearAllMocks());

  it('renders at / with the conversation list', async () => {
    mockListConversations.mockResolvedValue([CONVERSATION]);

    const router = await renderRoute({ index: HomeScreen });

    expect(router.getPathname()).toBe('/');
    expect(screen.getByTestId('Home-Screen')).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByText('Stag do')).toBeOnTheScreen());
    expect(screen.getByText('See you there!')).toBeOnTheScreen();
  });

  it('shows an empty state with no conversations', async () => {
    mockListConversations.mockResolvedValue([]);

    await renderRoute({ index: HomeScreen });

    await waitFor(() => expect(screen.getByTestId('Home-EmptyText')).toBeOnTheScreen());
  });

  it('shows "No messages yet" for a conversation with no last message', async () => {
    mockListConversations.mockResolvedValue([{ ...CONVERSATION, lastMessage: null }]);

    await renderRoute({ index: HomeScreen });

    await waitFor(() => expect(screen.getByText('No messages yet')).toBeOnTheScreen());
  });

  it('shows a mapped error message when loading fails', async () => {
    mockListConversations.mockRejectedValue(new DataError('not_authenticated'));

    await renderRoute({ index: HomeScreen });

    await waitFor(() => expect(screen.getByTestId('Home-ErrorText')).toBeOnTheScreen());
  });

  it('navigates to create-group when "New group" is pressed', async () => {
    mockListConversations.mockResolvedValue([]);
    const user = userEvent.setup();

    const router = await renderRoute({ index: HomeScreen, 'create-group': () => null });
    await waitFor(() => expect(screen.getByTestId('Home-EmptyText')).toBeOnTheScreen());

    await user.press(screen.getByTestId('Home-NewGroupButton'));

    await waitFor(() => expect(router.getPathname()).toBe('/create-group'));
  });

  it('navigates to the conversation when a row is pressed', async () => {
    mockListConversations.mockResolvedValue([CONVERSATION]);
    const user = userEvent.setup();

    const router = await renderRoute({ index: HomeScreen, 'conversation/[id]': () => null });
    await waitFor(() => expect(screen.getByText('Stag do')).toBeOnTheScreen());

    await user.press(screen.getByTestId('Home-Conversation-conv-1'));

    await waitFor(() => expect(router.getPathname()).toBe('/conversation/conv-1'));
  });
});
