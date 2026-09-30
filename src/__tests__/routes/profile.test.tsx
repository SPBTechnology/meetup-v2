import { screen, userEvent, waitFor } from '@testing-library/react-native';

import ProfileScreen from '../../app/(app)/profile';
import { getProfile, signOut, updateProfile } from '../../data/auth';
import { DataError } from '../../data/errors';
import { fakeSession, fakeUser } from '../../test-utils/supabaseFixtures';
import { renderRoute } from '../../test-utils/renderRoute';

const mockSessionValue = { session: fakeSession({ user: fakeUser({ id: 'user-1' }) }), loading: false };

jest.mock('../../data/auth', () => ({
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
  signOut: jest.fn(),
}));
jest.mock('../../hooks/useSession', () => ({ useSession: () => mockSessionValue }));

const mockGetProfile = getProfile as jest.Mock;
const mockUpdateProfile = updateProfile as jest.Mock;
const mockSignOut = signOut as jest.Mock;

const PROFILE = { id: 'user-1', displayName: 'Alice', avatarUrl: null, phoneNumber: '+447700900001' };

describe('profile route', () => {
  afterEach(() => jest.clearAllMocks());

  it('loads and displays the current profile', async () => {
    mockGetProfile.mockResolvedValue(PROFILE);

    await renderRoute({ index: ProfileScreen });

    await waitFor(() => expect(screen.getByTestId('Profile-DisplayNameInput')).toHaveProp('value', 'Alice'));
    expect(screen.getByTestId('Profile-PhoneNumberInput')).toHaveProp('value', '+447700900001');
    expect(mockGetProfile).toHaveBeenCalledWith('user-1');
  });

  it('saves the trimmed display name and phone number', async () => {
    mockGetProfile.mockResolvedValue(PROFILE);
    mockUpdateProfile.mockResolvedValue({ ...PROFILE, displayName: 'Alice B' });
    const user = userEvent.setup();

    await renderRoute({ index: ProfileScreen });
    await waitFor(() => expect(screen.getByTestId('Profile-DisplayNameInput')).toHaveProp('value', 'Alice'));

    await user.clear(screen.getByTestId('Profile-DisplayNameInput'));
    await user.type(screen.getByTestId('Profile-DisplayNameInput'), '  Alice B  ');
    await user.press(screen.getByTestId('Profile-SaveButton'));

    await waitFor(() =>
      expect(mockUpdateProfile).toHaveBeenCalledWith('user-1', {
        displayName: 'Alice B',
        phoneNumber: '+447700900001',
      }),
    );
    await waitFor(() => expect(screen.getByTestId('Profile-SavedText')).toBeOnTheScreen());
  });

  it('sends null when the phone number is cleared', async () => {
    mockGetProfile.mockResolvedValue(PROFILE);
    mockUpdateProfile.mockResolvedValue({ ...PROFILE, phoneNumber: null });
    const user = userEvent.setup();

    await renderRoute({ index: ProfileScreen });
    await waitFor(() => expect(screen.getByTestId('Profile-PhoneNumberInput')).toHaveProp('value', '+447700900001'));

    await user.clear(screen.getByTestId('Profile-PhoneNumberInput'));
    await user.press(screen.getByTestId('Profile-SaveButton'));

    await waitFor(() =>
      expect(mockUpdateProfile).toHaveBeenCalledWith('user-1', { displayName: 'Alice', phoneNumber: null }),
    );
  });

  it('shows a mapped error message when saving fails', async () => {
    mockGetProfile.mockResolvedValue(PROFILE);
    mockUpdateProfile.mockRejectedValue(new DataError('phone_number_taken'));
    const user = userEvent.setup();

    await renderRoute({ index: ProfileScreen });
    await waitFor(() => expect(screen.getByTestId('Profile-DisplayNameInput')).toHaveProp('value', 'Alice'));
    await user.press(screen.getByTestId('Profile-SaveButton'));

    await waitFor(() => expect(screen.getByTestId('Profile-ErrorText')).toBeOnTheScreen());
    expect(screen.getByText(/already linked to another account/)).toBeOnTheScreen();
    expect(screen.queryByTestId('Profile-SavedText')).not.toBeOnTheScreen();
  });

  it('shows a mapped error message when the initial load fails', async () => {
    mockGetProfile.mockRejectedValue(new DataError('not_authenticated'));

    await renderRoute({ index: ProfileScreen });

    await waitFor(() => expect(screen.getByTestId('Profile-ErrorText')).toBeOnTheScreen());
  });

  it('signs out when the sign-out button is pressed', async () => {
    mockGetProfile.mockResolvedValue(PROFILE);
    mockSignOut.mockResolvedValue(undefined);
    const user = userEvent.setup();

    await renderRoute({ index: ProfileScreen });
    await waitFor(() => expect(screen.getByTestId('Profile-DisplayNameInput')).toHaveProp('value', 'Alice'));
    await user.press(screen.getByTestId('Profile-SignOutButton'));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  });
});
