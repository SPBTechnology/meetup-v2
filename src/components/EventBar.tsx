import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { EventSummary } from '../data/events';
import { EventChip } from './EventChip';

export type EventBarProps = {
  events: EventSummary[];
  loading: boolean;
  onSelectEvent: (eventId: string) => void;
  onAddEvent: () => void;
};

export function EventBar({ events, loading, onSelectEvent, onAddEvent }: EventBarProps) {
  return (
    <View style={styles.container} testID="EventBar">
      {loading ? (
        <ActivityIndicator testID="EventBar-Loading" style={styles.loading} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {events.map((event) => (
            <EventChip key={event.id} event={event} onPress={() => onSelectEvent(event.id)} />
          ))}
          <Pressable style={styles.addButton} onPress={onAddEvent} testID="EventBar-AddButton">
            <Text style={styles.addButtonText}>+ Event</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingVertical: 8,
  },
  loading: {
    paddingVertical: 10,
  },
  scroll: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  addButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '600',
  },
});
