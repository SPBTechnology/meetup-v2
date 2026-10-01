import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import CreateGroupScreen from '../../app/(app)/create-group';
import { createConversation } from '../../data/conversations';
import { DataError } from '../../data/errors';
import { renderRoute } from '../../test-utils/renderRoute';

jest.mock('../../data/conversations', () => ({
  createConversation: jest.fn(),
}));

const mockCreateConversation = createConversation as jest.Mock;

describe('create-group route', () => {
  afterEach(() => jest.clearAllMocks());

  it('creates a group with the entered name and navigates to it', async () => {
    mockCreateConversation.mockResolvedValue('conv-1');
    const user = userEvent.setup();

    const router = await renderRoute({ index: CreateGroupScreen, 'conversation/[id]': () => null });

    await user.type(screen.getByTestId('CreateGroup-NameInput'), 'Stag do');
    await user.press(screen.getByTestId('CreateGroup-CreateButton'));

    await waitFor(() => expect(mockCreateConversation).toHaveBeenCalledWith({ name: 'Stag do' }));
    await waitFor(() => expect(router.getPathname()).toBe('/conversation/conv-1'));
  });

  it('allows creating with no name', async () => {
    mockCreateConversation.mockResolvedValue('conv-2');
    const user = userEvent.setup();

    await renderRoute({ index: CreateGroupScreen, 'conversation/[id]': () => null });
    await user.press(screen.getByTestId('CreateGroup-CreateButton'));

    await waitFor(() => expect(mockCreateConversation).toHaveBeenCalledWith({ name: '' }));
  });

  it('shows a mapped error message and stops submitting when creation fails', async () => {
    mockCreateConversation.mockRejectedValue(new DataError('not_authenticated'));
    const user = userEvent.setup();

    await renderRoute({ index: CreateGroupScreen });
    await user.press(screen.getByTestId('CreateGroup-CreateButton'));

    await waitFor(() => expect(screen.getByTestId('CreateGroup-ErrorText')).toBeOnTheScreen());
    expect(screen.getByText('Create')).toBeOnTheScreen();
  });

  it('goes back to the previous screen when Cancel is pressed', async () => {
    const user = userEvent.setup();

    const testRouter = await renderRoute({ index: () => null, 'create-group': CreateGroupScreen });
    act(() => router.push('/create-group'));
    await waitFor(() => expect(testRouter.getPathname()).toBe('/create-group'));

    await user.press(screen.getByTestId('CreateGroup-CancelButton'));

    await waitFor(() => expect(testRouter.getPathname()).toBe('/'));
  });
});
