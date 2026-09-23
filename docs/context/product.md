# Product

## One line

A group chat where plans live next to the conversation: events with candidate dates,
locations and everyone's availability, so a group can go from "we should do something"
to "it's booked" without losing the thread.

## Who it's for (in priority order)

1. **Groups formed around a plan** — trips, stag/hen dos, birthdays, reunions. These groups
   are created fresh for the occasion, so choosing this app over WhatsApp costs nobody a
   migration. This is the beachhead.
2. **Recurring clubs** — running clubs, five-a-side, book groups. They have a standing need
   to track who's coming each time (the Spond / TeamSnap niche).
3. **Long-lived casual friend groups** — hardest to win (they already live in WhatsApp).
   Not a launch target; don't optimise for them yet.

Rationale and the critique that led here: [ADR 0001](decisions/0001-fresh-start.md) and
`docs/archive/claude_initial_critique.md`.

## MVP scope (must work end-to-end before anything else)

- Sign up / sign in (email + password); profile with display name and phone number
- Create a group conversation; **invite people** — by code/link, and from the phonebook
  (existing users matched by phone number; non-users get an SMS invite)
- Realtime messaging in a conversation
- Events inside a conversation: title, one or more candidate dates, one or more locations;
  members respond ✓ / ? / ✗ per date; the creator confirms a date
- Push notifications for new messages and event changes

A feature is "in" when its UI flow works on a device and it is tested at every relevant
layer (see [testing.md](testing.md)).

## Explicit non-goals (until MVP is done and used by real groups)

- **Smart intents / suggestions** from chat messages (the prototype's T39 work). To be
  redesigned later with a context-aware LLM, based on how real groups actually phrase
  availability. Principle stands: AI suggests, humans confirm — never auto-apply.
- **Venue app** (vendor offers). When it comes, it uses the *request* model: a group asks
  "find us somewhere for 8 on Saturday" and venues respond. It must never mine private chat.
  It depends on structured event data, not message text.
- Device calendar integration, media messages, voice notes, end-to-end encryption
  (E2EE is an open question — see below).

## Principles

- Chat must work without any AI.
- Humans confirm; nothing is inferred into shared state without an explicit tap.
- Privacy first: no feature reads message content server-side without explicit, specific opt-in.

## Open questions (resolve before the phase that needs them)

| Question | Needed by |
|----------|-----------|
| E2EE: goal, non-goal, or later? Constrains any future server-side intent processing. | Before intents phase |
| Target launch city / community for first real groups | Before first external testers |
| Consent model for any message analysis (per user? per group?) | Before intents phase |
