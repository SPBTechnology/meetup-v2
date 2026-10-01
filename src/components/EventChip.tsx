import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { EventSummary } from '../data/events';

const STATUS_COLORS: Record<EventSummary['status'], string> = {
  planning: '#f59e0b',
  confirmed: '#16a34a',
  cancelled: '#9ca3af',
};

function formatNearestDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export type EventChipProps = {
  event: EventSummary;
  onPress: () => void;
};

export function EventChip({ event, onPress }: EventChipProps) {
  return (
    <Pressable style={styles.chip} onPress={onPress} testID={`EventChip-${event.id}`}>
      <View style={styles.header}>
        <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[event.status] }]} />
        <Text style={styles.title} numberOfLines={1}>
          {event.title}
        </Text>
      </View>

      <Text style={styles.detail} numberOfLines={1}>
        {event.multiDate ? 'Multiple dates' : event.nearestDate ? formatNearestDate(event.nearestDate) : 'No date yet'}
      </Text>
      {event.location && (
        <Text style={styles.detail} numberOfLines={1}>
          {event.location}
        </Text>
      )}

      {!event.multiDate && event.responseCounts && (
        <View style={styles.responses}>
          <Text style={styles.responseText}>✓ {event.responseCounts.accepted}</Text>
          <Text style={styles.responseText}>? {event.responseCounts.maybe}</Text>
          <Text style={styles.responseText}>✗ {event.responseCounts.declined}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
    minWidth: 150,
    maxWidth: 200,
    gap: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  detail: {
    fontSize: 12,
    color: '#6b7280',
  },
  responses: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  responseText: {
    fontSize: 12,
    color: '#374151',
  },
});
