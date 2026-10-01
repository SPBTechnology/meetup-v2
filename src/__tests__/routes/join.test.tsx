import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import JoinScreen from '../../app/(app)/join';
import { acceptInvite } from '../../data/invites';
import { DataError } from '../../data/errors';
import { renderRoute } from '../../test-utils/renderRoute';

jest.mock('../../data/invites', () => ({
  acceptInvite: jest.fn(),
}));

const mockAcceptInvite = acceptInvite as jest.Mock;

describe('join route', () => {
  afterEach(() => jest.clearAllMocks());

  it('joins with the entered code and navigates to the conversation', async () => {
    mockAcceptInvite.mockResolvedValue('conv-1');
    const user = userEvent.setup();

    const testRouter = await renderRoute({ index: JoinScreen, 'conversation/[id]': () => null });

    await user.type(screen.getByTestId('Join-CodeInput'), 'ABCD-EFGH');
    await user.press(screen.getByTestId('Join-SubmitButton'));

    await waitFor(() => expect(mockAcceptInvite).toHaveBeenCalledWith('ABCD-EFGH'));
    await waitFor(() => expect(testRouter.getPathname()).toBe('/conversation/conv-1'));
  });

  it('shows a mapped error and stops submitting when the code is invalid', async () => {
    mockAcceptInvite.mockRejectedValue(new DataError('invite_not_found'));
    const user = userEvent.setup();

    await renderRoute({ index: JoinScreen });

    await user.type(screen.getByTestId('Join-CodeInput'), 'BADCODE1');
    await user.press(screen.getByTestId('Join-SubmitButton'));

    await waitFor(() => expect(screen.getByTestId('Join-ErrorText')).toBeOnTheScreen());
    expect(screen.getByText('Join')).toBeOnTheScreen();
  });

  it('disables Join until a code is entered', async () => {
    await renderRoute({ index: JoinScreen });

    expect(screen.getByTestId('Join-SubmitButton')).toBeDisabled();
  });

  it('goes back to the previous screen when Cancel is pressed', async () => {
    const user = userEvent.setup();

    const testRouter = await renderRoute({ index: () => null, join: JoinScreen });
    act(() => router.push('/join'));
    await waitFor(() => expect(testRouter.getPathname()).toBe('/join'));

    await user.press(screen.getByTestId('Join-CancelButton'));

    await waitFor(() => expect(testRouter.getPathname()).toBe('/'));
  });
});
