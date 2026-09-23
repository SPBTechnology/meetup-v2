This is my honest take on the concept and the current build. The biggest point is at the end.

# 1. The concept

## User app (group chat with events)

**What's strong**
- The problem is real. Group plans die in the scroll: "who said Saturday?", "did Dave reply?". A summary of who can make which date, kept next to the chat, is useful.
- Your own principle, "AI detects and surfaces, humans confirm", is the right one.

**What worries me**
- **Getting people to switch from WhatsApp is the main risk.** People don't move group chats. WhatsApp already has group events with RSVPs and polls, and Partiful, Howbout and Doodle cover the planning side. Copying a WhatsApp-style chat means building features people expect but that don't set you apart: push notifications, media, voice notes, read receipts, offline sync, reliability, and probably end-to-end encryption. That's years of work that competitors already have.
  - **Alternative:** be the planning layer that sits alongside WhatsApp. A shareable event link, plus optional in-app chat for groups that choose it. Validate the planning value before paying for a full chat app.
- **"Saves typing" is a weak pitch.** People type the message anyway. The smart layer saves one tap on the event card. The real value is the **automatic availability summary**, so pitch and design around that.
- **Group-chat language is much harder than it looks.** Examples:
  - people speaking for others ("Dave can't do Friday")
  - hedging ("might be able to")
  - sarcasm, quotes and replies
  - several events being discussed in one chat
  - dates relative to earlier messages

  Each wrong update that reaches the shared event costs trust with the whole group, not just the sender.
- **Privacy conflicts with the business model.** WhatsApp-style users expect private chats. The smart layer and the venue app both need to read messages. You have to settle this before building further. The architecture doc marks it as P1 and it's still open.

## Venue app (monetised)

**What's strong**
- Venues do want predictable repeat group business, and an offer for a known group is a better pitch than generic ads.

**What worries me**
- **The current design reads as surveillance.** "I mentioned a bar in my private chat and a competitor sent me an offer" is the kind of story that ends up in the press. It's also a GDPR problem: consent has to be specific and freely given, and chats can reveal sensitive data such as health or religion.
  - **Flip it to something users ask for.** The group taps "Find us somewhere: 8 people, Saturday, Merchant City", and venues respond with offers. The same data is now a service rather than monitoring, the consent is built into the tap, and the venues' leads are stronger.
- **Drop the "competitor intelligence" tier completely.** The legal and reputational risk is far larger than the revenue.
- **Charging tokens per notification is a hard sell.** Venues are paying for leads that may never turn into bookings. Paying per redemption or per booking (TheFork's model) lines up incentives better and is simpler to explain.
- **Hands-off auto-offers are feasible, but not the way the docs describe them:**
  - They should be a **rules engine the venue controls** ("groups of 6+, visited 3+ times, Tue–Thu → 10% off"), not an AI deciding on the venue's behalf. Venues will want predictable, explainable rules.
  - Auto-accepting a booking needs **table availability**, so it needs integrations with booking systems like ResDiary, SevenRooms or OpenTable. Otherwise you'll confirm tables the venue doesn't have.
  - "Known group" and "recurring business" need proof the group **actually attended** (check-in or redemption codes). Planning to go isn't the same as going, and without proof the system can be gamed.
  - No-shows need deposits or a reliability score per group.
- **Chicken-and-egg problem.** Venues only pay if there are enough active groups in their area. Launch in one city (Glasgow, going by the docs) and don't build the venue app until you have groups there.

# 2. The current setup

## Supabase: a good choice, used in a fragile way
- The choice itself is right: relational data model, RLS, Realtime and cheap local development.
- **The weak point is running the executor inside the app.** Business rules like "propose a date, accept one, decline others" run on the phone as several separate writes, each checked by RLS. When RLS blocks one, the workaround became a dev server holding the full-access key, which doesn't exist in production.
  - **Fix:** move authoritative actions into Postgres functions (e.g. `propose_date(event_id, dates[])`) or Edge Functions. Each action becomes atomic and authorised in one place, works in production, and the dev server can go.
- **Migration discipline has slipped:**
  - migration files were edited after being applied
  - a script patches policies directly on the database
  - three new tables have RLS switched off

## The regex "SLM"
- **It isn't a small language model.** It's a rule-based classifier, which is fine as a baseline, but the name suggests capability it doesn't have.
- **Specific weaknesses:**
  - The first pattern that matches wins, so pattern order decides the intent.
  - The confidence scores are hard-coded constants, not measured probabilities. That makes thresholds such as `0.6` or `autoAcceptThreshold` meaningless.
  - The location extractor turns "count me in for Saturday" into the location "for Saturday".
  - Date handling mixes local time and UTC.
  - It always targets the most recent event and has no idea who the message is about.
- **The code went against your own architecture doc.** The doc says to use a cloud LLM for intent and date extraction and not an on-device model. It was right.
  - A small hosted model with structured JSON output could see the last several messages, the events and their date options, and the participants. It would handle "Dave can't make it", replies and multiple events. Per-message cost is small, and you can keep the regex as a cheap pre-filter so the model only sees likely messages.
  - If you want privacy-first later, on-device models such as Apple Foundation Models or Gemini Nano are a realistic step. Hand-built k-NN personalisation is not.
- **The personalisation and telemetry work is premature.** It has no users to learn from.

## Realtime chat and suggestion UX
- Realtime via database change events is fine for an MVP. At scale, Supabase recommends its Broadcast channels for chat.
- **Push notifications (T46) are missing,** and without them the chat can't really be used day to day.
- **Auto-apply contradicts your "humans confirm" principle.** Remove it.
- **The `__INTENT_AUDIT__` debug messages are written into the real messages table,** so every participant sees them. Log them somewhere else.
- **Showing the suggestion only to the sender is correct.** Keep that.

# 3. The biggest issue: the build order skipped ahead

`architecture.md` lays out a sensible phased roadmap, where each phase tests a hypothesis before the next is built. The build jumped ahead to v1.1/v1.2 AI personalisation. Meanwhile:
- **There's still no way to invite anyone** (T42/T43).
- **There are no push notifications.**

So the core question, "will groups use this to plan?", can't be tested with real people yet, and effort is going into a smart layer and test infrastructure (Detox, EAS, emulator scripts) for an app nobody can join.

**My suggested order:**
1. Build invites and push notifications, and get 3–5 real friend groups using it with manual events.
2. Watch how they actually phrase availability. That becomes your intent test set.
3. Replace the regex with an LLM that has conversation context, behind a server-side action layer.
4. Only then think about venues, starting with the "find us somewhere" request model.

On that basis, I'd do the RLS and consent fixes now (they're small) but not spend much time on the intent bug. The code it lives in will probably be replaced.

I can turn this into a shareable page if you want to pass it to anyone else.

You're right about the specific thing I suggested. An event link shared into WhatsApp can't read the chat, so it loses both the smart intents and the flow of information to the venue app. I skipped over that.

I don't think that kills the idea, though. It depends on separating what actually has to be true from what the current design assumes.

## What each part really depends on

**The venue app needs structured events, not chat text.** It needs: group of 8, Saturday, Merchant City, night out, this group has been here before. That lives in your `events` table, however it got there. If you go with the "find us somewhere" model I suggested, the venue app never needs to read a message. So the monetised side doesn't depend on who owns the chat. That's the most important point here.

**The smart intents need free-text availability, not necessarily the whole chat.** The goal is "people reply naturally and the event updates itself". That can happen anywhere people reply about the event. It doesn't have to be the group's general chat.

So the question isn't "replace WhatsApp or die". It's **where the planning conversation happens.** There are three realistic answers.

## Option 1: Your own chat, aimed at groups with low switching costs
The main risk I raised is that people don't move *existing* friend groups. Many of your own example use cases aren't existing groups:
- **Stag dos, trips, birthdays:** someone creates a new group for them anyway. If that group is created in your app, nobody is switching. Your app is just where the group starts.
- **Recurring clubs** (your "Tuesday run" example): Spond and TeamSnap show these groups will use a dedicated app with chat, because tracking who's coming is the whole point.
- **Casual "who fancies a night out" friend groups:** the hardest to win. Don't target them first.

This keeps the whole concept intact: your chat, your intents, your venue link. It changes who you target first, not what you build. You'd still eventually need chat features people expect (push notifications, media), but for groups that exist for a plan, a basic version will do.

## Option 2: The event space gets its own thread (Partiful model)
The WhatsApp group keeps the banter. The event link opens a page with its own thread and RSVP. Free-text replies there ("can't do Fri, Sat's fine") go through the intent layer. You own that surface, so the smart layer and the venue connection both work. The trade-off is that some planning talk will stay in WhatsApp, where you can't see it.

## Option 3: A bot inside existing chat apps
- **Telegram and Discord:** bots can read group messages if the group allows it. Fully workable, but it's a smaller UK consumer audience.
- **WhatsApp:** it's restrictive. Meta's Business Platform has added some group features and tightened rules on AI bots. I'd check the current terms before relying on it. Treat this as a later distribution channel, not the foundation.

## My recommendation
**Option 1, aimed at groups created for a plan (trips, stags, celebrations) and at recurring clubs.** That's close to your original vision, so you're not giving up the concept. It also gets rid of the WhatsApp switching problem as far as early adoption goes. Option 2's event page can come later as a way in for people who aren't on the app yet. Invitees who don't use the app land on the event page from an SMS or WhatsApp link, which fits neatly with T43's SMS invites.

What I'd take back from the critique is "don't build chat". What I'd keep is "don't try to take over existing group chats first". Your current codebase already fits Option 1. The immediate order doesn't change either: invites and push notifications come first, because a new group has to be able to form in your app before anything else matters.You're right about the specific thing I suggested. An event link shared into WhatsApp can't read the chat, so it loses both the smart intents and the flow of information to the venue app. I skipped over that.

I don't think that kills the idea, though. It depends on separating what actually has to be true from what the current design assumes.

## What each part really depends on

**The venue app needs structured events, not chat text.** It needs: group of 8, Saturday, Merchant City, night out, this group has been here before. That lives in your `events` table, however it got there. If you go with the "find us somewhere" model I suggested, the venue app never needs to read a message. So the monetised side doesn't depend on who owns the chat. That's the most important point here.

**The smart intents need free-text availability, not necessarily the whole chat.** The goal is "people reply naturally and the event updates itself". That can happen anywhere people reply about the event. It doesn't have to be the group's general chat.

So the question isn't "replace WhatsApp or die". It's **where the planning conversation happens.** There are three realistic answers.

## Option 1: Your own chat, aimed at groups with low switching costs
The main risk I raised is that people don't move *existing* friend groups. Many of your own example use cases aren't existing groups:
- **Stag dos, trips, birthdays:** someone creates a new group for them anyway. If that group is created in your app, nobody is switching. Your app is just where the group starts.
- **Recurring clubs** (your "Tuesday run" example): Spond and TeamSnap show these groups will use a dedicated app with chat, because tracking who's coming is the whole point.
- **Casual "who fancies a night out" friend groups:** the hardest to win. Don't target them first.

This keeps the whole concept intact: your chat, your intents, your venue link. It changes who you target first, not what you build. You'd still eventually need chat features people expect (push notifications, media), but for groups that exist for a plan, a basic version will do.

## Option 2: The event space gets its own thread (Partiful model)
The WhatsApp group keeps the banter. The event link opens a page with its own thread and RSVP. Free-text replies there ("can't do Fri, Sat's fine") go through the intent layer. You own that surface, so the smart layer and the venue connection both work. The trade-off is that some planning talk will stay in WhatsApp, where you can't see it.

## Option 3: A bot inside existing chat apps
- **Telegram and Discord:** bots can read group messages if the group allows it. Fully workable, but it's a smaller UK consumer audience.
- **WhatsApp:** it's restrictive. Meta's Business Platform has added some group features and tightened rules on AI bots. I'd check the current terms before relying on it. Treat this as a later distribution channel, not the foundation.

## My recommendation
**Option 1, aimed at groups created for a plan (trips, stags, celebrations) and at recurring clubs.** That's close to your original vision, so you're not giving up the concept. It also gets rid of the WhatsApp switching problem as far as early adoption goes. Option 2's event page can come later as a way in for people who aren't on the app yet. Invitees who don't use the app land on the event page from an SMS or WhatsApp link, which fits neatly with T43's SMS invites.

What I'd take back from the critique is "don't build chat". What I'd keep is "don't try to take over existing group chats first". Your current codebase already fits Option 1. The immediate order doesn't change either: invites and push notifications come first, because a new group has to be able to form in your app before anything else matters.