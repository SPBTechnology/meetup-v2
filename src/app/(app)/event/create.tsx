import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { createEvent } from '../../../data/events';
import { isDataError } from '../../../data/errors';
import { combineDateAndTime } from '../../../lib/dateTime';
import { describeDataError } from '../../../lib/errorMessages';

function formatDateTime(date: Date): string {
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function CreateEventScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [locations, setLocations] = useState<string[]>([]);
  const [locationDraft, setLocationDraft] = useState('');
  const [dates, setDates] = useState<Date[]>([]);
  const [pickerStage, setPickerStage] = useState<'none' | 'date' | 'time'>('none');
  const [pickedDate, setPickedDate] = useState<Date | null>(null);
  const [allowAltDates, setAllowAltDates] = useState(false);
  const [allowAltLocations, setAllowAltLocations] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleAddLocation() {
    const trimmed = locationDraft.trim();
    if (trimmed === '') return;
    setLocations((prev) => [...prev, trimmed]);
    setLocationDraft('');
  }

  function handleRemoveLocation(index: number) {
    setLocations((prev) => prev.filter((_, i) => i !== index));
  }

  function handleRemoveDate(index: number) {
    setDates((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreate() {
    const trimmedTitle = title.trim();
    if (trimmedTitle === '') return;
    setSubmitting(true);
    setError(null);
    try {
      const id = await createEvent({
        conversationId,
        title: trimmedTitle,
        startsAt: dates.map((d) => d.toISOString()),
        locations,
        allowAltDates,
        allowAltLocations,
      });
      router.replace(`/event/${id}`);
    } catch (err) {
      setError(isDataError(err) ? describeDataError(err.code) : describeDataError('unknown'));
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} testID="CreateEvent-Screen">
      <View style={styles.header}>
        <Text style={styles.title}>New event</Text>
        <Pressable onPress={() => router.back()} testID="CreateEvent-CancelButton">
          <Text style={styles.link}>Cancel</Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.input}
        testID="CreateEvent-TitleInput"
        placeholder="Event title"
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.sectionTitle}>Locations</Text>
      {locations.map((name, index) => (
        <View key={`${name}-${index}`} style={styles.listRow} testID={`CreateEvent-Location-${index}`}>
          <Text style={styles.listRowText}>{name}</Text>
          <Pressable onPress={() => handleRemoveLocation(index)} testID={`CreateEvent-RemoveLocation-${index}`}>
            <Text style={styles.link}>Remove</Text>
          </Pressable>
        </View>
      ))}
      <View style={styles.addRow}>
        <TextInput
          style={[styles.input, styles.addRowInput]}
          testID="CreateEvent-LocationInput"
          placeholder="Add a location"
          value={locationDraft}
          onChangeText={setLocationDraft}
          onSubmitEditing={handleAddLocation}
        />
        <Pressable onPress={handleAddLocation} testID="CreateEvent-AddLocationButton">
          <Text style={styles.link}>Add</Text>
        </Pressable>
      </View>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Let others suggest locations</Text>
        <Switch value={allowAltLocations} onValueChange={setAllowAltLocations} testID="CreateEvent-AllowAltLocationsToggle" />
      </View>

      <Text style={styles.sectionTitle}>Dates</Text>
      {dates.map((date, index) => (
        <View key={date.toISOString()} style={styles.listRow} testID={`CreateEvent-Date-${index}`}>
          <Text style={styles.listRowText}>{formatDateTime(date)}</Text>
          <Pressable onPress={() => handleRemoveDate(index)} testID={`CreateEvent-RemoveDate-${index}`}>
            <Text style={styles.link}>Remove</Text>
          </Pressable>
        </View>
      ))}
      <Pressable onPress={() => setPickerStage('date')} testID="CreateEvent-AddDateButton">
        <Text style={styles.link}>+ Add date</Text>
      </Pressable>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Let others suggest dates</Text>
        <Switch value={allowAltDates} onValueChange={setAllowAltDates} testID="CreateEvent-AllowAltDatesToggle" />
      </View>

      {error && (
        <Text style={styles.error} testID="CreateEvent-ErrorText">
          {error}
        </Text>
      )}

      <Pressable
        style={[styles.createButton, (submitting || title.trim() === '') && styles.createButtonDisabled]}
        onPress={handleCreate}
        disabled={submitting || title.trim() === ''}
        testID="CreateEvent-CreateButton"
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.createButtonText}>Create event</Text>}
      </Pressable>

      {pickerStage === 'date' && (
        <DateTimePicker
          value={pickedDate ?? new Date()}
          mode="date"
          onChange={(_event, date) => {
            if (date) {
              setPickedDate(date);
              setPickerStage('time');
            } else {
              setPickerStage('none');
            }
          }}
        />
      )}
      {pickerStage === 'time' && pickedDate && (
        <DateTimePicker
          value={pickedDate}
          mode="time"
          onChange={(_event, time) => {
            setPickerStage('none');
            if (time) setDates((prev) => [...prev, combineDateAndTime(pickedDate, time)]);
          }}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  link: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
    marginBottom: 8,
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  listRowText: {
    fontSize: 15,
    flexShrink: 1,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addRowInput: {
    flex: 1,
    marginBottom: 0,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  toggleLabel: {
    fontSize: 14,
    color: '#374151',
  },
  error: {
    color: '#dc2626',
    fontSize: 14,
    marginTop: 8,
  },
  createButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 32,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
