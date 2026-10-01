import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';

import CreateEventScreen from '../../app/(app)/event/create';
import { createEvent } from '../../data/events';
import { DataError } from '../../data/errors';
import { renderRoute } from '../../test-utils/renderRoute';

jest.mock('../../data/events', () => ({
  createEvent: jest.fn(),
}));

// A stand-in for the native picker that exposes a testID per mode and fires
// onChange on press. Real date/time combination logic lives in
// src/lib/dateTime.ts and is tested directly there.
jest.mock('@react-native-community/datetimepicker', () => {
  // require, not import: jest.mock() factories are hoisted above imports.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pressable } = require('react-native');
  return function MockDateTimePicker({ mode, onChange }: { mode: string; onChange: (e: object, d: Date) => void }) {
    return <Pressable testID={`MockDateTimePicker-${mode}`} onPress={() => onChange({}, new Date(2027, 5, 1, 19, 0))} />;
  };
});

const mockCreateEvent = createEvent as jest.Mock;

describe('create-event route', () => {
  afterEach(() => jest.clearAllMocks());

  async function renderScreen() {
    return renderRoute(
      { 'event/create': CreateEventScreen, 'event/[id]': () => null },
      { initialUrl: '/event/create?conversationId=conv-1' },
    );
  }

  it('creates an event with the entered title, locations, and toggles', async () => {
    mockCreateEvent.mockResolvedValue('event-1');
    const user = userEvent.setup();
    const router = await renderScreen();

    await user.type(screen.getByTestId('CreateEvent-TitleInput'), 'Edinburgh');

    await user.type(screen.getByTestId('CreateEvent-LocationInput'), 'The Bow Bar');
    await user.press(screen.getByTestId('CreateEvent-AddLocationButton'));
    expect(screen.getByTestId('CreateEvent-Location-0')).toBeOnTheScreen();

    // Switch doesn't respond to userEvent.press (no onPress) — it reports
    // state via onValueChange, which fireEvent can target directly. Must be
    // explicitly act()-wrapped: plain fireEvent on Switch left pending state
    // updates that broke tests run after this one in this file.
    await act(() => {
      fireEvent(screen.getByTestId('CreateEvent-AllowAltLocationsToggle'), 'valueChange', true);
      fireEvent(screen.getByTestId('CreateEvent-AllowAltDatesToggle'), 'valueChange', true);
    });

    await act(() => user.press(screen.getByTestId('CreateEvent-AddDateButton')));
    await act(() => user.press(screen.getByTestId('MockDateTimePicker-date')));
    await waitFor(() => expect(screen.getByTestId('MockDateTimePicker-time')).toBeOnTheScreen());
    await act(() => user.press(screen.getByTestId('MockDateTimePicker-time')));
    await waitFor(() => expect(screen.getByTestId('CreateEvent-Date-0')).toBeOnTheScreen());

    await user.press(screen.getByTestId('CreateEvent-CreateButton'));

    await waitFor(() =>
      expect(mockCreateEvent).toHaveBeenCalledWith({
        conversationId: 'conv-1',
        title: 'Edinburgh',
        startsAt: [new Date(2027, 5, 1, 19, 0).toISOString()],
        locations: ['The Bow Bar'],
        allowAltDates: true,
        allowAltLocations: true,
      }),
    );
    await waitFor(() => expect(router.getPathname()).toBe('/event/event-1'));
  });

  it('removes a location when Remove is pressed', async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.type(screen.getByTestId('CreateEvent-LocationInput'), 'The Bow Bar');
    await user.press(screen.getByTestId('CreateEvent-AddLocationButton'));
    await user.press(screen.getByTestId('CreateEvent-RemoveLocation-0'));

    expect(screen.queryByTestId('CreateEvent-Location-0')).not.toBeOnTheScreen();
  });

  it('disables Create until a title is entered', async () => {
    await renderScreen();

    expect(screen.getByTestId('CreateEvent-CreateButton')).toBeDisabled();
  });

  it('shows a mapped error and stops submitting on failure', async () => {
    mockCreateEvent.mockRejectedValue(new DataError('not_authenticated'));
    const user = userEvent.setup();
    await renderScreen();

    await user.type(screen.getByTestId('CreateEvent-TitleInput'), 'Edinburgh');
    await user.press(screen.getByTestId('CreateEvent-CreateButton'));

    await waitFor(() => expect(screen.getByTestId('CreateEvent-ErrorText')).toBeOnTheScreen());
    expect(screen.getByText('Create event')).toBeOnTheScreen();
  });
});
