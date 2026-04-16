# Innernet — Features & Layout

## App Layout
- Three-panel sliding layout: Calendar (left) | Main area (right)
- Main area toggles between **Do** (Agent Chat) and **Think** (Document Editor) via a toggle bar
- Calendar sidebar is collapsible with a toggle button; width is resizable via drag handle
- All panels use CSS transform-based sliding with smooth transitions

---

## Calendar UI — Google Calendar Style, Single-Day View

### Header
- **Today** button — jumps back to the current date
- Prev/next day arrows for single-day navigation
- Current date title (e.g. "9 April 2026")
- Clicking the date title toggles an inline mini calendar dropdown
- Zoom +/- buttons (semantic zoom: pixel zoom -> schedule list -> detail view)

### Day Navigation
- Click any date in the mini calendar picker
- Mini calendar shows the full month grid with:
  - Prev/next month navigation
  - Click any day in the current month -> jumps the day view to that date
  - Dot indicators on days that have events
- Infinite scroll / pull-to-flip days — over-scroll at the top or bottom of the grid to step to the previous/next day, with a progress hint showing how far the pull has travelled
- Slide transition animations when changing days

### Time Grid
- 24-hour time grid with hour labels in the gutter
- Sub-hour tick marks (:30, :15, :45) that fade in/out with zoom level — granularity progressively disclosed
- Current time "now line" indicator (red dot + horizontal rule) on today's view
- Cmd/Ctrl + scroll wheel for continuous zoom anchored on cursor position
- Hour label stride thins at very low zoom to prevent overlap

### Temporal Visual Treatment
- Past events — faded/muted appearance
- Current event (bracketing "now") — normal/highlighted
- Future events — dimmed, click/hover suppressed (no summary/activity yet)

### Overlapping Events
- Side-by-side column layout automatically computed for overlapping time blocks
- Connected overlap groups share column count for consistent widths

---

## Event Interaction

### Hover Peek
- Hover an event -> a small floating peek card fades in after a short delay (~380ms)
- Shows: title, time range, AI summary (star icon), next undone action item
- Peek card placed above the event; flips below if too close to top
- Suppressed for future events and while overlay is open

### Click to Expand
- Click any event block -> unfolds into a full overlay card
- Unfold animates from the event block's position (origin-aware)
- Close via X button, Escape key, or clicking backdrop
- Close plays a refold animation back to origin

### Expanded Event Detail (Split Layout)
- **Summary** — AI-generated summary (with Read more/Show less), planned vs. completed approach, linked feature docs (matched by project/tags), agent session chips
- **Work Activity** — files changed (+/- diff stats), tabs opened, sites visited
- **Activity & Logs** — collapsible section, logs filtered to the event's time window (user + agent actions, grouped by session)

### Drag-to-Reschedule
- Mouse-drag any event block to move it to a different time slot
- 15-minute snap grid; visual ghost shows new position during drag
- Commits on mouse-up; original position restored if drag distance < 5px (click tolerance)

### Resize Events
- Drag the bottom edge handle of any event to change its duration
- 15-minute snap grid; minimum duration of 15 minutes
- Visual feedback during resize

---

## Semantic Zoom (3 View Modes)

### Mode 0 — Time Grid (default)
- Pixel-level zoom via +/- buttons (2 discrete steps) or Cmd/Ctrl + wheel (continuous)
- Zoom range: 24px/hr (compressed full day) to 240px/hr (fine-grained)
- Scroll position anchored on viewport center during zoom

### Mode 1 — Schedule List
- All events across all dates, grouped by date with weekday + date headers
- Click any event -> opens detail view (mode 2) for that event
- Triggered by 3rd zoom-in click from mode 0

### Mode 2 — Detail View
- Full event card with summary, work activity, files, logs
- Left/right arrow navigation between events
- Keyboard navigation: Arrow keys (prev/next), Escape (back to schedule list)
- Close button returns to schedule list (mode 1)

---

## Empty-Slot Quick Notes
- Click any empty time slot -> an inline note composer pops up at that exact time, auto-focused
- Type + Enter saves the note; Esc or click-away dismisses without saving (typing-then-clicking-away still saves)
- Saved notes persist as purple "thought blocks" on the time grid
- Thought blocks show latest note text + count badge (+N) for multiple notes at same slot
- Click a thought block to re-open the quick-note composer at that time

---

## Search & Time Queries

### Search Bar
- Placeholder: `Search #project or name, or ask a question...`
- Replaces the time grid with search results when active

### Plain Text Search
- `#projectname` (e.g. `#colab91`) -> filters events where project or tag matches
- Free text (e.g. `Tanuj`) -> filters by event title, attendee, tag, or project
- Results grouped by date with weekday + date headers (Google Calendar schedule view style)
- Click a result -> opens inline detail view with back-to-results button
- Click "Jump to date" -> navigates the day view to that date and selects the event

### Natural-Language Time Queries
- **"When was I most productive?"** -> productivity analysis card with the winning time window, activity counts, agent sessions, tasks done, focus time, and runner-ups with bar chart
- **"How much time on #project"** -> total time + daily breakdown bars across matching events
- **"When are my meetings?"** -> all events with attendees, sorted by date/time in schedule view
- **"When am I free?" / "free time"** -> gaps >= 45 min within 9-18 on the current day
- Every result row is clickable to jump into the relevant day/event

---

## Natural-Language Scheduling
- `"schedule a meeting with Tanuj on 10 April 3 pm"` -> parses intent + type + attendees + date + time, creates the event on that date
- Recognized event types: meeting, call, sync, standup, catchup, chat, 1:1, interview, review, lunch, coffee, event
- Date parsing: today, tomorrow, weekday names (next Monday), day+month ("10 April", "April 10th")
- Time parsing: 12-hour ("3 pm", "3:30pm") and 24-hour ("15:00", "at 9:30")
- Attendee extraction: "with Tanuj and Priya" -> parsed attendee list
- Commits only on Enter
- On success, a green confirmation card replaces the search results:
  - Checkmark + "Meeting scheduled" label, event title, date, time window, attendees
  - "Jump to date" -> navigates the day view to the new event and selects it
  - "Done" -> dismisses the card and stays on the current day

---

## Document Panel (Think Mode)
- Logseq-style outliner / block editor for daily journal pages
- Tree-based nested block structure with rich inline editing
- AI insertion markers for agent-generated content
- localStorage persistence across sessions
- Feature document items with "Ask AI" integration and "Implement All" bulk action

---

## Agent Chat (Do Mode)
- Multi-tab agent session interface
- Real-time message streaming via OpenRouter API (GPT-4o-mini)
- Context-aware prompt building from event/feature data
- Markdown rendering with syntax highlighting
- Sessions spawned by "Ask AI" on features or "Implement All"

---

## Event Color System
- 8 soft pastel color sets (green, red/pink, blue, orange, purple, teal, yellow, brown)
- Each color has background, border, and text values
- Events assigned colors via `colorIndex`

---

## Tech Stack
- **Frontend:** React 19 + Vite 5 (SPA, no routing)
- **Styling:** Pure CSS with custom properties (30+ design tokens), no Tailwind
- **AI:** OpenRouter API (GPT-4o-mini) for agent chat and feature suggestions
- **Storage:** localStorage for journal/document persistence
- **Backend:** Cloudflare Workers (wrangler config in place, KV sync planned)
- **Fonts:** Inter + JetBrains Mono
