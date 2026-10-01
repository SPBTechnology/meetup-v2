import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

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
  type EventResponseValue,
} from '../../../data/events';
import { isDataError } from '../../../data/errors';
import { useSession } from '../../../hooks/useSession';
import { combineDateAndTime } from '../../../lib/dateTime';
import { describeDataError } from '../../../lib/errorMessages';

const STATUS_LABEL: Record<EventDetail['status'], string> = {
  planning: 'Planning',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;

  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [locationDraft, setLocationDraft] = useState('');
  const [addingLocation, setAddingLocation] = useState(false);
  const [pickerStage, setPickerStage] = useState<'none' | 'date' | 'time'>('none');
  const [pickedDate, setPickedDate] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!userId) return;
    getEventDetail(id, userId)
      .then(setDetail)
      .catch((err: unknown) => setError(isDataError(err) ? describeDataError(err.code) : describeDataError('unknown')))
      .finally(() => setLoading(false));
  }, [id, userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Keyed on the option ids themselves (not `detail` as a whole) so a new
  // response/count doesn't tear the channel down — only an actual add/remove
  // of a date option does, which is exactly when event_responses' stale,
  // client-side-filtered option list (see subscribeToEventDetail) needs it.
  const optionIdsKey = detail?.dateOptions.map((o) => o.id).join(',') ?? '';
  useEffect(() => {
    if (!detail) return;
    return subscribeToEventDetail(id, optionIdsKey === '' ? [] : optionIdsKey.split(','), load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, load, optionIdsKey]);

  const isCreator = !!detail && detail.createdBy === userId;
  const canAddDate = !!detail && (isCreator || detail.allowAltDates);
  const canAddLocation = !!detail && (isCreator || detail.allowAltLocations);

  async function handleSaveTitle() {
    const trimmed = titleDraft.trim();
    if (trimmed === '' || !detail) return;
    setBusy(true);
    try {
      await updateEvent(detail.id, { title: trimmed });
      setEditingTitle(false);
      load();
    } catch (err) {
      setError(isDataError(err) ? describeDataError(err.code) : describeDataError('unknown'));
    } finally {
      setBusy(false);
    }
  }

  async function handleAddLocation() {
    const trimmed = locationDraft.trim();
    if (trimmed === '' || !detail) return;
    setBusy(true);
    try {
      await addLocation(detail.id, trimmed, detail.locations.length, userId!);
      setLocationDraft('');
      setAddingLocation(false);
      load();
    } catch (err) {
      setError(isDataError(err) ? describeDataError(err.code) : describeDataError('unknown'));
    } finally {
      setBusy(false);
    }
  }

  async function handlePickedDateTime(date: Date) {
    if (!detail) return;
    setBusy(true);
    try {
      await addDateOption(detail.id, date.toISOString(), userId!);
      load();
    } catch (err) {
      setError(isDataError(err) ? describeDataError(err.code) : describeDataError('unknown'));
    } finally {
      setBusy(false);
    }
  }

  async function handleRespond(dateOptionId: string, response: EventResponseValue) {
    if (!userId) return;
    setBusy(true);
    try {
      await respondToDateOption(dateOptionId, userId, response);
      load();
    } catch (err) {
      setError(isDataError(err) ? describeDataError(err.code) : describeDataError('unknown'));
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(dateOptionId: string) {
    if (!detail) return;
    setBusy(true);
    try {
      await confirmEvent(detail.id, dateOptionId);
      load();
    } catch (err) {
      setError(isDataError(err) ? describeDataError(err.code) : describeDataError('unknown'));
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelEvent() {
    if (!detail) return;
    setBusy(true);
    try {
      await cancelEvent(detail.id);
      load();
    } catch (err) {
      setError(isDataError(err) ? describeDataError(err.code) : describeDataError('unknown'));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center} testID="EventDetail-Screen">
        <ActivityIndicator size="large" testID="EventDetail-Loading" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} testID="EventDetail-Screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="EventDetail-CloseButton">
          <Text style={styles.close}>Close</Text>
        </Pressable>
      </View>

      {error && (
        <Text style={styles.error} testID="EventDetail-ErrorText">
          {error}
        </Text>
      )}

      {detail && (
        <>
          {editingTitle ? (
            <View style={styles.titleEditRow}>
              <TextInput
                style={styles.titleInput}
                testID="EventDetail-TitleInput"
                value={titleDraft}
                onChangeText={setTitleDraft}
                autoFocus
              />
              <Pressable onPress={handleSaveTitle} disabled={busy} testID="EventDetail-SaveTitleButton">
                <Text style={styles.link}>Save</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.titleRow}>
              <Text style={styles.title}>{detail.title}</Text>
              {isCreator && (
                <Pressable
                  onPress={() => {
                    setTitleDraft(detail.title);
                    setEditingTitle(true);
                  }}
                  testID="EventDetail-EditTitleButton"
                >
                  <Text style={styles.link}>Edit</Text>
                </Pressable>
              )}
            </View>
          )}

          <Text style={styles.status} testID="EventDetail-StatusText">
            {STATUS_LABEL[detail.status]}
          </Text>

          <Text style={styles.sectionTitle}>Locations</Text>
          {detail.locations.length === 0 && <Text style={styles.hint}>No locations yet.</Text>}
          {detail.locations.map((location) => (
            <Text key={location.id} style={styles.locationText} testID={`EventDetail-Location-${location.id}`}>
              {location.name}
            </Text>
          ))}
          {canAddLocation &&
            (addingLocation ? (
              <View style={styles.titleEditRow}>
                <TextInput
                  style={styles.titleInput}
                  testID="EventDetail-LocationInput"
                  value={locationDraft}
                  onChangeText={setLocationDraft}
                  placeholder="Location name"
                  autoFocus
                />
                <Pressable onPress={handleAddLocation} disabled={busy} testID="EventDetail-SaveLocationButton">
                  <Text style={styles.link}>Add</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => setAddingLocation(true)} testID="EventDetail-AddLocationButton">
                <Text style={styles.link}>+ Add location</Text>
              </Pressable>
            ))}

          <Text style={styles.sectionTitle}>Dates</Text>
          {detail.dateOptions.length === 0 && <Text style={styles.hint}>No dates proposed yet.</Text>}
          {detail.dateOptions.map((option) => {
            const confirmed = detail.confirmedOptionId === option.id;
            return (
              <View key={option.id} style={styles.optionRow} testID={`EventDetail-Option-${option.id}`}>
                <Text style={styles.optionDate}>
                  {formatDateTime(option.startsAt)}
                  {confirmed ? ' · Confirmed' : ''}
                </Text>
                <View style={styles.responseButtons}>
                  {(['accepted', 'maybe', 'declined'] as const).map((value) => (
                    <Pressable
                      key={value}
                      style={[styles.responseButton, option.myResponse === value && styles.responseButtonActive]}
                      onPress={() => handleRespond(option.id, value)}
                      disabled={busy}
                      testID={`EventDetail-Respond-${option.id}-${value}`}
                    >
                      <Text
                        style={[styles.responseButtonText, option.myResponse === value && styles.responseButtonTextActive]}
                      >
                        {value === 'accepted' ? '✓' : value === 'maybe' ? '?' : '✗'} {option.responseCounts[value]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {isCreator && detail.status === 'planning' && !confirmed && (
                  <Pressable onPress={() => handleConfirm(option.id)} disabled={busy} testID={`EventDetail-Confirm-${option.id}`}>
                    <Text style={styles.link}>Confirm this date</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
          {canAddDate && (
            <Pressable onPress={() => setPickerStage('date')} testID="EventDetail-AddDateButton">
              <Text style={styles.link}>+ Add date</Text>
            </Pressable>
          )}

          {isCreator && detail.status !== 'cancelled' && (
            <Pressable style={styles.cancelButton} onPress={handleCancelEvent} disabled={busy} testID="EventDetail-CancelEventButton">
              <Text style={styles.cancelButtonText}>Cancel event</Text>
            </Pressable>
          )}
        </>
      )}

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
            if (time) void handlePickedDateTime(combineDateAndTime(pickedDate, time));
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 24,
    paddingBottom: 8,
  },
  close: {
    fontSize: 16,
    color: '#2563eb',
  },
  error: {
    color: '#dc2626',
    fontSize: 14,
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    flexShrink: 1,
  },
  titleEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  titleInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
  },
  link: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '600',
  },
  status: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  locationText: {
    fontSize: 15,
    marginBottom: 6,
  },
  optionRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 6,
  },
  optionDate: {
    fontSize: 15,
    fontWeight: '600',
  },
  responseButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  responseButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  responseButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  responseButtonText: {
    fontSize: 13,
    color: '#111827',
  },
  responseButtonTextActive: {
    color: '#fff',
  },
  cancelButton: {
    marginTop: 24,
    marginBottom: 24,
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: '#dc2626',
    fontSize: 15,
    fontWeight: '600',
  },
});
