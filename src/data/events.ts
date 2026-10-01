import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import type { Database } from '../types/database.types';
import { fromPostgrestError } from './errors';

export type EventStatus = Database['public']['Enums']['event_status'];
export type EventResponseValue = Database['public']['Enums']['event_response'];

export type ResponseCounts = { accepted: number; maybe: number; declined: number };

export type EventSummary = {
  id: string;
  conversationId: string;
  title: string;
  status: EventStatus;
  createdBy: string | null;
  createdAt: string;
  multiDate: boolean;
  nearestDate: string | null;
  singleDateOptionId: string | null;
  /** Hidden (null) when multiDate — an aggregate across different dates would be misleading. */
  responseCounts: ResponseCounts | null;
  /** A single location's name, "Multiple locations", or null when there are none yet. */
  location: string | null;
};

function toEventSummary(row: Database['public']['Views']['event_summaries']['Row']): EventSummary {
  const locationCount = row.location_count ?? 0;
  return {
    id: row.id!,
    conversationId: row.conversation_id!,
    title: row.title!,
    status: row.status!,
    createdBy: row.created_by,
    createdAt: row.created_at!,
    multiDate: row.multi_date!,
    nearestDate: row.nearest_date,
    singleDateOptionId: row.single_date_option_id,
    responseCounts: row.multi_date
      ? null
      : { accepted: row.accepted_count ?? 0, maybe: row.maybe_count ?? 0, declined: row.declined_count ?? 0 },
    location: locationCount === 0 ? null : locationCount === 1 ? row.first_location_name : 'Multiple locations',
  };
}

/** Events in a conversation the caller is a member of, newest first. */
export async function listEventSummaries(conversationId: string): Promise<EventSummary[]> {
  const { data, error } = await supabase
    .from('event_summaries')
    .select()
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false });
  if (error) throw fromPostgrestError(error);
  return data.map(toEventSummary);
}

export type DateOption = {
  id: string;
  startsAt: string;
  endsAt: string | null;
  responseCounts: ResponseCounts;
  myResponse: EventResponseValue | null;
};

export type EventLocation = {
  id: string;
  name: string;
  sortOrder: number;
};

export type EventDetail = {
  id: string;
  conversationId: string;
  title: string;
  description: string | null;
  status: EventStatus;
  allowAltDates: boolean;
  allowAltLocations: boolean;
  confirmedOptionId: string | null;
  createdBy: string | null;
  dateOptions: DateOption[];
  locations: EventLocation[];
};

function emptyCounts(): ResponseCounts {
  return { accepted: 0, maybe: 0, declined: 0 };
}

/** The full event — date options (with response counts + the caller's own response) and locations. */
export async function getEventDetail(eventId: string, userId: string): Promise<EventDetail> {
  const [eventResult, optionsResult, locationsResult] = await Promise.all([
    supabase.from('events').select().eq('id', eventId).single(),
    supabase.from('event_date_options').select().eq('event_id', eventId).order('starts_at'),
    supabase.from('event_locations').select().eq('event_id', eventId).order('sort_order'),
  ]);
  if (eventResult.error) throw fromPostgrestError(eventResult.error);
  if (optionsResult.error) throw fromPostgrestError(optionsResult.error);
  if (locationsResult.error) throw fromPostgrestError(locationsResult.error);

  const optionIds = optionsResult.data.map((o) => o.id);
  const responsesResult =
    optionIds.length > 0
      ? await supabase.from('event_responses').select().in('date_option_id', optionIds)
      : { data: [], error: null };
  if (responsesResult.error) throw fromPostgrestError(responsesResult.error);

  const dateOptions: DateOption[] = optionsResult.data.map((option) => {
    const counts = emptyCounts();
    let myResponse: EventResponseValue | null = null;
    for (const response of responsesResult.data) {
      if (response.date_option_id !== option.id) continue;
      counts[response.response]++;
      if (response.user_id === userId) myResponse = response.response;
    }
    return { id: option.id, startsAt: option.starts_at, endsAt: option.ends_at, responseCounts: counts, myResponse };
  });

  const event = eventResult.data;
  return {
    id: event.id,
    conversationId: event.conversation_id,
    title: event.title,
    description: event.description,
    status: event.status,
    allowAltDates: event.allow_alt_dates,
    allowAltLocations: event.allow_alt_locations,
    confirmedOptionId: event.confirmed_option_id,
    createdBy: event.created_by,
    dateOptions,
    locations: locationsResult.data.map((l) => ({ id: l.id, name: l.name, sortOrder: l.sort_order })),
  };
}

export type CreateEventParams = {
  conversationId: string;
  title: string;
  description?: string;
  startsAt?: string[];
  locations?: string[];
  allowAltDates?: boolean;
  allowAltLocations?: boolean;
};

/** Creates an event with its initial date options and locations in one transaction. */
export async function createEvent(params: CreateEventParams): Promise<string> {
  const { data, error } = await supabase.rpc('create_event', {
    p_conversation_id: params.conversationId,
    p_title: params.title,
    p_description: params.description,
    p_starts_at: params.startsAt,
    p_locations: params.locations,
    p_allow_alt_dates: params.allowAltDates,
    p_allow_alt_locations: params.allowAltLocations,
  });
  if (error) throw fromPostgrestError(error);
  return data;
}

export type UpdateEventParams = {
  title?: string;
  description?: string | null;
  allowAltDates?: boolean;
  allowAltLocations?: boolean;
};

/** Edits an event's own fields. Only the creator's update passes RLS. */
export async function updateEvent(eventId: string, patch: UpdateEventParams): Promise<void> {
  const row: Database['public']['Tables']['events']['Update'] = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.allowAltDates !== undefined) row.allow_alt_dates = patch.allowAltDates;
  if (patch.allowAltLocations !== undefined) row.allow_alt_locations = patch.allowAltLocations;
  const { error } = await supabase.from('events').update(row).eq('id', eventId);
  if (error) throw fromPostgrestError(error);
}

/** Confirms an event on one of its own date options. Only the creator's update passes RLS. */
export async function confirmEvent(eventId: string, dateOptionId: string): Promise<void> {
  const { error } = await supabase
    .from('events')
    .update({ status: 'confirmed', confirmed_option_id: dateOptionId })
    .eq('id', eventId);
  if (error) throw fromPostgrestError(error);
}

/** Cancels an event. Only the creator's update passes RLS. */
export async function cancelEvent(eventId: string): Promise<void> {
  const { error } = await supabase.from('events').update({ status: 'cancelled' }).eq('id', eventId);
  if (error) throw fromPostgrestError(error);
}

/** Adds a date option. The creator always can; other members only when the event allows it. */
export async function addDateOption(eventId: string, startsAt: string, createdBy: string): Promise<DateOption> {
  const { data, error } = await supabase
    .from('event_date_options')
    .insert({ event_id: eventId, starts_at: startsAt, created_by: createdBy })
    .select()
    .single();
  if (error) throw fromPostgrestError(error);
  return { id: data.id, startsAt: data.starts_at, endsAt: data.ends_at, responseCounts: emptyCounts(), myResponse: null };
}

/** The event creator only (RLS). */
export async function deleteDateOption(dateOptionId: string): Promise<void> {
  const { error } = await supabase.from('event_date_options').delete().eq('id', dateOptionId);
  if (error) throw fromPostgrestError(error);
}

/** Adds a location. The creator always can; other members only when the event allows it. */
export async function addLocation(
  eventId: string,
  name: string,
  sortOrder: number,
  createdBy: string,
): Promise<EventLocation> {
  const { data, error } = await supabase
    .from('event_locations')
    .insert({ event_id: eventId, name, sort_order: sortOrder, created_by: createdBy })
    .select()
    .single();
  if (error) throw fromPostgrestError(error);
  return { id: data.id, name: data.name, sortOrder: data.sort_order };
}

/** The event creator only (RLS). */
export async function updateLocationName(locationId: string, name: string): Promise<void> {
  const { error } = await supabase.from('event_locations').update({ name }).eq('id', locationId);
  if (error) throw fromPostgrestError(error);
}

/** The event creator only (RLS). */
export async function deleteLocation(locationId: string): Promise<void> {
  const { error } = await supabase.from('event_locations').delete().eq('id', locationId);
  if (error) throw fromPostgrestError(error);
}

/** Sets (or changes) the caller's own response to a date option. */
export async function respondToDateOption(
  dateOptionId: string,
  userId: string,
  response: EventResponseValue,
): Promise<void> {
  const { error } = await supabase
    .from('event_responses')
    .upsert({ date_option_id: dateOptionId, user_id: userId, response }, { onConflict: 'date_option_id,user_id' });
  if (error) throw fromPostgrestError(error);
}

/** Subscribes to new/changed events in a conversation (for the EventBar list). Returns an unsubscribe function. */
export function subscribeToEventList(conversationId: string, onChange: () => void): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`events:${conversationId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'events', filter: `conversation_id=eq.${conversationId}` },
      onChange,
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

/**
 * Subscribes to changes affecting one event's detail: its date options and
 * locations (both filterable by event_id), and responses (not filterable
 * server-side — event_responses has no event_id column — so this filters
 * client-side against the option ids the caller currently knows about).
 */
export function subscribeToEventDetail(eventId: string, optionIds: string[], onChange: () => void): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`event-detail:${eventId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'event_date_options', filter: `event_id=eq.${eventId}` },
      onChange,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'event_locations', filter: `event_id=eq.${eventId}` },
      onChange,
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'event_responses' }, (payload) => {
      const row = (payload.new ?? payload.old) as { date_option_id?: string };
      if (row.date_option_id && optionIds.includes(row.date_option_id)) onChange();
    })
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
