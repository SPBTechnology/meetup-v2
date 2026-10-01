import { render, screen, userEvent } from '@testing-library/react-native';

import { EventChip } from '../EventChip';
import type { EventSummary } from '../../data/events';

const BASE_EVENT: EventSummary = {
  id: 'event-1',
  conversationId: 'conv-1',
  title: 'Edinburgh',
  status: 'planning',
  createdBy: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
  multiDate: false,
  nearestDate: '2027-05-01T19:00:00Z',
  singleDateOptionId: 'opt-1',
  responseCounts: { accepted: 2, maybe: 1, declined: 0 },
  location: 'The Pub',
};

describe('EventChip', () => {
  it('shows the title, date, location, and response counts for a single-date event', async () => {
    await render(<EventChip event={BASE_EVENT} onPress={jest.fn()} />);

    expect(screen.getByText('Edinburgh')).toBeOnTheScreen();
    expect(screen.getByText('The Pub')).toBeOnTheScreen();
    expect(screen.getByText('✓ 2')).toBeOnTheScreen();
    expect(screen.getByText('? 1')).toBeOnTheScreen();
    expect(screen.getByText('✗ 0')).toBeOnTheScreen();
  });

  it('shows "Multiple dates" and hides response counts when multi-date', async () => {
    await render(
      <EventChip event={{ ...BASE_EVENT, multiDate: true, nearestDate: null, responseCounts: null }} onPress={jest.fn()} />,
    );

    expect(screen.getByText('Multiple dates')).toBeOnTheScreen();
    expect(screen.queryByText(/✓/)).not.toBeOnTheScreen();
  });

  it('shows "No date yet" when there are no date options', async () => {
    await render(<EventChip event={{ ...BASE_EVENT, nearestDate: null, responseCounts: null }} onPress={jest.fn()} />);

    expect(screen.getByText('No date yet')).toBeOnTheScreen();
  });

  it('omits the location line when there is none', async () => {
    await render(<EventChip event={{ ...BASE_EVENT, location: null }} onPress={jest.fn()} />);

    expect(screen.queryByText('The Pub')).not.toBeOnTheScreen();
  });

  it('calls onPress when tapped', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(<EventChip event={BASE_EVENT} onPress={onPress} />);

    await user.press(screen.getByTestId('EventChip-event-1'));

    expect(onPress).toHaveBeenCalled();
  });
});
