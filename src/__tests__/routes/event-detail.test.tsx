import { act, screen, userEvent, waitFor } from '@testing-library/react-native';

import EventDetailScreen from '../../app/(app)/event/[id]';
import {
  addDateOption,
  addLocation,
  cancelEvent,
  confirmEvent,
  getEventDetail,
  respondToDateOption,
  subscribeToEventDetail,
  updateEvent,
  type EventDetail,
} from '../../data/events';
import { DataError } from '../../data/errors';
import { fakeSession, fakeUser } from '../../test-utils/supabaseFixtures';
import { renderRoute } from '../../test-utils/renderRoute';

const mockSessionValue = { session: fakeSession({ user: fakeUser({ id: 'user-1' }) }), loading: false };

jest.mock('../../data/events', () => ({
  getEventDetail: jest.fn(),
  updateEvent: jest.fn(),
  addLocation: jest.fn(),
  addDateOption: jest.fn(),
  respondToDateOption: jest.fn(),
  confirmEvent: jest.fn(),
  cancelEvent: jest.fn(),
  subscribeToEventDetail: jest.fn(() => jest.fn()),
}));
jest.mock('../../hooks/useSession', () => ({ useSession: () => mockSessionValue }));
jest.mock('@react-native-community/datetimepicker', () => {
  // require, not import: jest.mock() factories are hoisted above imports.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pressable } = require('react-native');
  return function MockDateTimePicker({ mode, onChange }: { mode: string; onChange: (e: object, d: Date) => void }) {
    return <Pressable testID={`MockDateTimePicker-${mode}`} onPress={() => onChange({}, new Date(2027, 5, 1, 19, 0))} />;
  };
});

const mockGetEventDetail = getEventDetail as jest.Mock;
const mockUpdateEvent = updateEvent as jest.Mock;
const mockAddLocation = addLocation as jest.Mock;
const mockAddDateOption = addDateOption as jest.Mock;
const mockRespondToDateOption = respondToDateOption as jest.Mock;
const mockConfirmEvent = confirmEvent as jest.Mock;
const mockCancelEvent = cancelEvent as jest.Mock;

const BASE_DETAIL: EventDetail = {
  id: 'event-1',
  conversationId: 'conv-1',
  title: 'Edinburgh',
  description: null,
  status: 'planning',
  allowAltDates: false,
  allowAltLocations: false,
  confirmedOptionId: null,
  createdBy: 'user-1',
  dateOptions: [
    {
      id: 'opt-1',
      startsAt: '2027-05-01T19:00:00Z',
      endsAt: null,
      responseCounts: { accepted: 1, maybe: 0, declined: 0 },
      myResponse: 'accepted',
    },
  ],
  locations: [{ id: 'loc-1', name: 'The Bow Bar', sortOrder: 0 }],
};

async function renderScreen() {
  return renderRoute({ 'event/[id]': EventDetailScreen }, { initialUrl: '/event/event-1' });
}

describe('event detail route', () => {
  beforeEach(() => {
    mockGetEventDetail.mockResolvedValue(BASE_DETAIL);
  });

  afterEach(() => jest.clearAllMocks());

  it('shows the title, status, locations, and date options', async () => {
    await renderScreen();

    await waitFor(() => expect(screen.getByText('Edinburgh')).toBeOnTheScreen());
    expect(screen.getByTestId('EventDetail-StatusText')).toHaveTextContent('Planning');
    expect(screen.getByTestId('EventDetail-Location-loc-1')).toHaveTextContent('The Bow Bar');
    expect(screen.getByTestId('EventDetail-Respond-opt-1-accepted')).toBeOnTheScreen();
  });

  it('shows a mapped error when loading fails', async () => {
    mockGetEventDetail.mockRejectedValue(new DataError('not_authenticated'));

    await renderScreen();

    await waitFor(() => expect(screen.getByTestId('EventDetail-ErrorText')).toBeOnTheScreen());
  });

  it('lets the creator edit the title', async () => {
    mockUpdateEvent.mockResolvedValue(undefined);
    const user = userEvent.setup();
    await renderScreen();
    await waitFor(() => expect(screen.getByText('Edinburgh')).toBeOnTheScreen());

    await user.press(screen.getByTestId('EventDetail-EditTitleButton'));
    await user.clear(screen.getByTestId('EventDetail-TitleInput'));
    await user.type(screen.getByTestId('EventDetail-TitleInput'), 'Edinburgh trip');
    await user.press(screen.getByTestId('EventDetail-SaveTitleButton'));

    await waitFor(() => expect(mockUpdateEvent).toHaveBeenCalledWith('event-1', { title: 'Edinburgh trip' }));
  });

  it('does not show edit or add controls for a non-creator when alternatives are off', async () => {
    mockSessionValue.session = fakeSession({ user: fakeUser({ id: 'user-2' }) });
    await renderScreen();
    await waitFor(() => expect(screen.getByText('Edinburgh')).toBeOnTheScreen());

    expect(screen.queryByTestId('EventDetail-EditTitleButton')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('EventDetail-AddLocationButton')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('EventDetail-AddDateButton')).not.toBeOnTheScreen();

    mockSessionValue.session = fakeSession({ user: fakeUser({ id: 'user-1' }) }); // restore for other tests
  });

  it('lets a member add a location once allowed', async () => {
    mockAddLocation.mockResolvedValue({ id: 'loc-2', name: 'Oxford Bar', sortOrder: 1 });
    const user = userEvent.setup();
    await renderScreen();
    await waitFor(() => expect(screen.getByText('Edinburgh')).toBeOnTheScreen());

    await user.press(screen.getByTestId('EventDetail-AddLocationButton'));
    await user.type(screen.getByTestId('EventDetail-LocationInput'), 'Oxford Bar');
    await user.press(screen.getByTestId('EventDetail-SaveLocationButton'));

    await waitFor(() => expect(mockAddLocation).toHaveBeenCalledWith('event-1', 'Oxford Bar', 1, 'user-1'));
  });

  it('adds a date option via the two-stage picker', async () => {
    mockAddDateOption.mockResolvedValue({
      id: 'opt-2',
      startsAt: new Date(2027, 5, 1, 19, 0).toISOString(),
      endsAt: null,
      responseCounts: { accepted: 0, maybe: 0, declined: 0 },
      myResponse: null,
    });
    const user = userEvent.setup();
    await renderScreen();
    await waitFor(() => expect(screen.getByText('Edinburgh')).toBeOnTheScreen());

    await act(() => user.press(screen.getByTestId('EventDetail-AddDateButton')));
    await act(() => user.press(screen.getByTestId('MockDateTimePicker-date')));
    await waitFor(() => expect(screen.getByTestId('MockDateTimePicker-time')).toBeOnTheScreen());
    await act(() => user.press(screen.getByTestId('MockDateTimePicker-time')));

    await waitFor(() =>
      expect(mockAddDateOption).toHaveBeenCalledWith('event-1', new Date(2027, 5, 1, 19, 0).toISOString(), 'user-1'),
    );
  });

  it('responds to a date option', async () => {
    mockRespondToDateOption.mockResolvedValue(undefined);
    const user = userEvent.setup();
    await renderScreen();
    await waitFor(() => expect(screen.getByText('Edinburgh')).toBeOnTheScreen());

    await user.press(screen.getByTestId('EventDetail-Respond-opt-1-maybe'));

    await waitFor(() => expect(mockRespondToDateOption).toHaveBeenCalledWith('opt-1', 'user-1', 'maybe'));
  });

  it('lets the creator confirm a date option', async () => {
    mockConfirmEvent.mockResolvedValue(undefined);
    const user = userEvent.setup();
    await renderScreen();
    await waitFor(() => expect(screen.getByText('Edinburgh')).toBeOnTheScreen());

    await user.press(screen.getByTestId('EventDetail-Confirm-opt-1'));

    await waitFor(() => expect(mockConfirmEvent).toHaveBeenCalledWith('event-1', 'opt-1'));
  });

  it('lets the creator cancel the event', async () => {
    mockCancelEvent.mockResolvedValue(undefined);
    const user = userEvent.setup();
    await renderScreen();
    await waitFor(() => expect(screen.getByText('Edinburgh')).toBeOnTheScreen());

    await user.press(screen.getByTestId('EventDetail-CancelEventButton'));

    await waitFor(() => expect(mockCancelEvent).toHaveBeenCalledWith('event-1'));
  });

  it('subscribes to Realtime updates scoped to this event and its date options', async () => {
    await renderScreen();
    await waitFor(() => expect(screen.getByText('Edinburgh')).toBeOnTheScreen());

    expect(subscribeToEventDetail).toHaveBeenCalledWith('event-1', ['opt-1'], expect.any(Function));
  });
});
