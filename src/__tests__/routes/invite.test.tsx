import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { Contact, requestPermissionsAsync } from 'expo-contacts';
import * as SMS from 'expo-sms';
import { Share } from 'react-native';

import InviteScreen from '../../app/(app)/invite';
import { addParticipants } from '../../data/conversations';
import { DataError } from '../../data/errors';
import { getOrCreateActiveInvite, matchPhoneNumbers } from '../../data/invites';
import { fakeSession, fakeUser } from '../../test-utils/supabaseFixtures';
import { renderRoute } from '../../test-utils/renderRoute';

const mockSessionValue = { session: fakeSession({ user: fakeUser({ id: 'user-1' }) }), loading: false };

jest.mock('../../data/invites', () => ({
  getOrCreateActiveInvite: jest.fn(),
  matchPhoneNumbers: jest.fn(),
}));
jest.mock('../../data/conversations', () => ({
  addParticipants: jest.fn(),
}));
jest.mock('../../hooks/useSession', () => ({ useSession: () => mockSessionValue }));
jest.mock('expo-contacts', () => ({
  Contact: { getAllDetails: jest.fn() },
  ContactField: { FULL_NAME: 'fullName', PHONES: 'phones' },
  requestPermissionsAsync: jest.fn(),
}));
jest.mock('expo-sms', () => ({
  isAvailableAsync: jest.fn(),
  sendSMSAsync: jest.fn(),
}));

const mockGetOrCreateActiveInvite = getOrCreateActiveInvite as jest.Mock;
const mockMatchPhoneNumbers = matchPhoneNumbers as jest.Mock;
const mockAddParticipants = addParticipants as jest.Mock;
const mockGetAllDetails = Contact.getAllDetails as jest.Mock;
const mockRequestPermissionsAsync = requestPermissionsAsync as jest.Mock;
const mockIsAvailableAsync = SMS.isAvailableAsync as jest.Mock;
const mockSendSMSAsync = SMS.sendSMSAsync as jest.Mock;

const INVITE = {
  id: 'invite-1',
  conversationId: 'conv-1',
  code: 'ABCDEFGH',
  createdBy: 'user-1',
  expiresAt: '2099-01-01T00:00:00Z',
  maxUses: null,
  useCount: 0,
  revokedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
};

async function renderScreen() {
  return renderRoute({ 'invite': InviteScreen }, { initialUrl: '/invite?conversationId=conv-1' });
}

describe('invite route', () => {
  let shareSpy: jest.SpyInstance;

  beforeEach(() => {
    mockGetOrCreateActiveInvite.mockResolvedValue(INVITE);
    shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
  });

  afterEach(() => {
    jest.clearAllMocks();
    shareSpy.mockRestore();
  });

  it('shows the formatted invite code', async () => {
    await renderScreen();

    await waitFor(() => expect(screen.getByTestId('Invite-Code')).toHaveTextContent('ABCD-EFGH'));
    expect(mockGetOrCreateActiveInvite).toHaveBeenCalledWith('conv-1', 'user-1');
  });

  it('shows a mapped error when the invite cannot be created', async () => {
    mockGetOrCreateActiveInvite.mockRejectedValue(new DataError('not_authenticated'));

    await renderScreen();

    await waitFor(() => expect(screen.getByTestId('Invite-ErrorText')).toBeOnTheScreen());
  });

  it('shares a message containing the formatted code', async () => {
    const user = userEvent.setup();
    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('Invite-Code')).toBeOnTheScreen());

    await user.press(screen.getByTestId('Invite-ShareButton'));

    await waitFor(() =>
      expect(shareSpy).toHaveBeenCalledWith({ message: expect.stringContaining('ABCD-EFGH') }),
    );
  });

  it('shows a message when contacts permission is denied', async () => {
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'denied' });
    const user = userEvent.setup();

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('Invite-Code')).toBeOnTheScreen());
    await user.press(screen.getByTestId('Invite-FindContactsButton'));

    await waitFor(() => expect(screen.getByTestId('Invite-ContactsDeniedText')).toBeOnTheScreen());
  });

  it('splits contacts into matched (existing users) and unmatched', async () => {
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetAllDetails.mockResolvedValue([
      { id: 'c1', fullName: 'Bob', phones: [{ number: '+447700900002' }] },
      { id: 'c2', fullName: 'Carol', phones: [{ number: '+447700900003' }] },
    ]);
    mockMatchPhoneNumbers.mockResolvedValue([
      { userId: 'user-2', displayName: 'Bob', phoneNumber: '+447700900002' },
    ]);
    const user = userEvent.setup();

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('Invite-Code')).toBeOnTheScreen());
    await user.press(screen.getByTestId('Invite-FindContactsButton'));

    await waitFor(() => expect(screen.getByTestId('Invite-Matched-user-2')).toBeOnTheScreen());
    expect(screen.getByTestId('Invite-Unmatched-+447700900003')).toBeOnTheScreen();
    expect(mockMatchPhoneNumbers).toHaveBeenCalledWith(['+447700900002', '+447700900003']);
  });

  it('adds a matched contact directly to the conversation', async () => {
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetAllDetails.mockResolvedValue([{ id: 'c1', fullName: 'Bob', phones: [{ number: '+447700900002' }] }]);
    mockMatchPhoneNumbers.mockResolvedValue([
      { userId: 'user-2', displayName: 'Bob', phoneNumber: '+447700900002' },
    ]);
    mockAddParticipants.mockResolvedValue(1);
    const user = userEvent.setup();

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('Invite-Code')).toBeOnTheScreen());
    await user.press(screen.getByTestId('Invite-FindContactsButton'));
    await waitFor(() => expect(screen.getByTestId('Invite-AddButton-user-2')).toBeOnTheScreen());

    await user.press(screen.getByTestId('Invite-AddButton-user-2'));

    await waitFor(() => expect(mockAddParticipants).toHaveBeenCalledWith('conv-1', ['user-2']));
    await waitFor(() => expect(screen.getByText('Added')).toBeOnTheScreen());
  });

  it('texts an unmatched contact with the invite message', async () => {
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetAllDetails.mockResolvedValue([{ id: 'c1', fullName: 'Dave', phones: [{ number: '+447700900004' }] }]);
    mockMatchPhoneNumbers.mockResolvedValue([]);
    mockIsAvailableAsync.mockResolvedValue(true);
    mockSendSMSAsync.mockResolvedValue({ result: 'sent' });
    const user = userEvent.setup();

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('Invite-Code')).toBeOnTheScreen());
    await user.press(screen.getByTestId('Invite-FindContactsButton'));
    await waitFor(() => expect(screen.getByTestId('Invite-TextButton-+447700900004')).toBeOnTheScreen());

    await user.press(screen.getByTestId('Invite-TextButton-+447700900004'));

    await waitFor(() =>
      expect(mockSendSMSAsync).toHaveBeenCalledWith(['+447700900004'], expect.stringContaining('ABCD-EFGH')),
    );
  });
});
