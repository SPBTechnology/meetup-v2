import { render, screen, userEvent } from '@testing-library/react-native';

import { EventBar } from '../EventBar';
import type { EventSummary } from '../../data/events';

const EVENT: EventSummary = {
  id: 'event-1',
  conversationId: 'conv-1',
  title: 'Edinburgh',
  status: 'planning',
  createdBy: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
  multiDate: false,
  nearestDate: '2027-05-01T19:00:00Z',
  singleDateOptionId: 'opt-1',
  responseCounts: { accepted: 0, maybe: 0, declined: 0 },
  location: null,
};

describe('EventBar', () => {
  it('shows a loading indicator while loading', async () => {
    await render(<EventBar events={[]} loading={true} onSelectEvent={jest.fn()} onAddEvent={jest.fn()} />);

    expect(screen.getByTestId('EventBar-Loading')).toBeOnTheScreen();
  });

  it('renders a chip per event and the add button', async () => {
    await render(<EventBar events={[EVENT]} loading={false} onSelectEvent={jest.fn()} onAddEvent={jest.fn()} />);

    expect(screen.getByTestId('EventChip-event-1')).toBeOnTheScreen();
    expect(screen.getByTestId('EventBar-AddButton')).toBeOnTheScreen();
  });

  it('calls onSelectEvent with the event id when a chip is pressed', async () => {
    const onSelectEvent = jest.fn();
    const user = userEvent.setup();
    await render(<EventBar events={[EVENT]} loading={false} onSelectEvent={onSelectEvent} onAddEvent={jest.fn()} />);

    await user.press(screen.getByTestId('EventChip-event-1'));

    expect(onSelectEvent).toHaveBeenCalledWith('event-1');
  });

  it('calls onAddEvent when the add button is pressed', async () => {
    const onAddEvent = jest.fn();
    const user = userEvent.setup();
    await render(<EventBar events={[]} loading={false} onSelectEvent={jest.fn()} onAddEvent={onAddEvent} />);

    await user.press(screen.getByTestId('EventBar-AddButton'));

    expect(onAddEvent).toHaveBeenCalled();
  });
});
