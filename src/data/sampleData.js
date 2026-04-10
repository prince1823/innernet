// Color palette for events (soft pastel backgrounds)
export const eventColors = [
  { bg: '#e8f5e9', border: '#66bb6a', text: '#2e7d32' },   // green
  { bg: '#fce4ec', border: '#ef5350', text: '#c62828' },   // red/pink
  { bg: '#e3f2fd', border: '#42a5f5', text: '#1565c0' },   // blue
  { bg: '#fff3e0', border: '#ffa726', text: '#e65100' },   // orange
  { bg: '#f3e5f5', border: '#ab47bc', text: '#6a1b9a' },   // purple
  { bg: '#e0f2f1', border: '#26a69a', text: '#00695c' },   // teal
  { bg: '#fff8e1', border: '#ffca28', text: '#f57f17' },   // yellow
  { bg: '#efebe9', border: '#8d6e63', text: '#4e342e' },   // brown
]

// Calendar events with start and end times for weekly view
export const calendarTasks = {
  '2026-04-06': [
    { id: 'MF-06', title: 'Colab91 Feature Deep-Dive', time: '10:00', endTime: '11:30', colorIndex: 2 },
    { id: 'MF-07', title: 'Supplier Taxonomy Module', time: '14:00', endTime: '15:30', colorIndex: 4 },
  ],
  '2026-04-07': [
    { id: 'MF-08', title: 'Architecture Discussion', time: '9:00', endTime: '10:00', colorIndex: 0 },
    { id: 'MF-08b', title: 'Team Standup', time: '11:00', endTime: '11:30', colorIndex: 2 },
    { id: 'MF-08c', title: 'Code Review', time: '14:00', endTime: '15:00', colorIndex: 3 },
    { id: 'MF-08d', title: 'DevOps Sync', time: '16:00', endTime: '16:45', colorIndex: 5 },
  ],
  '2026-04-08': [
    { id: 'MF-09', title: 'Improve App Performance', time: '9:00', endTime: '10:30', colorIndex: 0, summary: 'Profiling and optimization session.', tags: ['perf', 'optimization'] },
    { id: 'MF-10', title: 'Design Jam — Notes UI', time: '13:00', endTime: '14:30', colorIndex: 1, summary: 'Collaborative session on the notes panel design.', tags: ['design', 'notes', 'UI'] },
    { id: 'MF-10b', title: 'Client Call', time: '15:00', endTime: '16:00', colorIndex: 3, summary: 'Demo\'d early prototype to client.', tags: ['client', 'demo'] },
  ],
  '2026-04-09': [
    {
      id: 'MF-12b', title: 'Morning Standup', time: '9:00', endTime: '9:30', colorIndex: 0,
      tags: ['standup', 'team'],
      attendees: ['Jason', 'Sarah', 'Mike'],
      aiSummary: 'The team shared progress updates on the three-panel layout implementation. All sprint items are on track. Two minor blockers were identified around state management, which the engineering lead will resolve by end of day.',
      notesTitle: 'Morning Standup Sync',
      notesSummary: 'Quick team sync covering sprint progress, blockers, and daily priorities for the Mindflow app development.',
      topicNotes: [
        { topic: 'Three-panel layout at 80% completion', timestamp: '9:03',
          bullets: [
            'CSS transform-based sliding is working smoothly across all three panels.',
            'Calendar panel has been fully redesigned to Google Calendar single-day style.',
            'Notes panel human/AI tab split is functional and ready for polish.',
          ]
        },
        { topic: 'Cross-panel state management identified as blocker', timestamp: '9:08',
          bullets: [
            'Selected event data needs to flow from Calendar → Notes panel seamlessly.',
            'State management for cross-panel communication needs refactoring.',
            'Engineering lead committed to resolving by end of day.',
          ]
        },
        { topic: 'Action items assigned for completion by EOD', timestamp: '9:13',
          bullets: [
            'Complete event-to-notes linking for calendar click interaction.',
            'Fix date/time mismatch showing in event detail cards.',
            'Add hashtags to calendar event blocks for quick categorization.',
          ]
        },
      ],
      transcription: [
        { speaker: 'Jason', time: '9:01', text: 'Good morning everyone. Let\'s do a quick round. Sarah, you start?' },
        { speaker: 'Sarah', time: '9:02', text: 'Calendar panel is done. Redesigned it to match Google Calendar. Single day view with time slots.' },
        { speaker: 'Mike', time: '9:05', text: 'Notes panel is mostly there. Working on the AI/human tab split. Should be done by lunch.' },
        { speaker: 'You', time: '9:08', text: 'I\'m on the three-panel layout. Sliding mechanism works. Need to wire up event selection to notes.' },
        { speaker: 'Jason', time: '9:12', text: 'Any blockers?' },
        { speaker: 'You', time: '9:13', text: 'State management for cross-panel data flow. I\'ll sort it out today.' },
        { speaker: 'Jason', time: '9:15', text: 'Great. Let\'s aim to have the full flow working by EOD.' },
      ],
      actionItems: [
        {
          person: 'Jason',
          tasks: [
            { text: 'Review the cross-panel state management approach and approve architecture', timestamp: '9:12', done: true },
          ]
        },
        {
          person: 'Sarah',
          tasks: [
            { text: 'Finalize calendar panel day-view styling and push to staging', timestamp: '9:02', done: true },
            { text: 'Document the Google Calendar redesign decisions for the team wiki', timestamp: '9:05', done: true },
          ]
        },
        {
          person: 'Mike',
          tasks: [
            { text: 'Complete the AI/human tab split in the notes panel by end of day', timestamp: '9:05', done: true },
          ]
        },
        {
          person: 'You',
          tasks: [
            { text: 'Wire up event selection from calendar to notes panel with shared state', timestamp: '9:08', done: false },
            { text: 'Fix the date/time mismatch between calendar events and note detail cards', timestamp: '9:13', done: true },
          ]
        },
      ]
    },
    {
      id: 'MF-11', title: 'Build Three-Panel Layout', time: '10:00', endTime: '12:00', colorIndex: 4,
      tags: ['dev', 'frontend', 'layout'],
      attendees: ['You'],
      aiSummary: 'Deep work session focused on implementing the core three-panel sliding layout using CSS transforms. Successfully built the phase-based panel switching mechanism where Calendar & Notes and Notes & Agent views toggle smoothly.',
      notesTitle: 'Three-Panel Layout Implementation',
      notesSummary: 'Deep work session focused on building the core sliding panel system using CSS transforms, with successful phase-based switching between Calendar & Notes and Notes & Agent views.',
      topicNotes: [
        { topic: 'Panel architecture finalized with CSS transform approach', timestamp: '10:05',
          bullets: [
            'Three panels sit in a 150% width track container that slides left/right.',
            'Phase toggle shifts the track using translateX(0) and translateX(-33.33%).',
            'Notes panel is always visible as the anchor between both phases, creating continuity.',
          ]
        },
        { topic: 'CSS Grid layout working for panel track', timestamp: '10:32',
          bullets: [
            'Each panel is 50% of viewport width within the track container.',
            'Transition uses transform: translateX() with 0.3s ease for smooth sliding.',
            'Overflow: hidden on viewport container clips off-screen panels during transition.',
          ]
        },
        { topic: 'Overflow and z-index issues resolved', timestamp: '10:45',
          bullets: [
            'Initial issue with panels bleeding outside viewport during transitions.',
            'Fixed by setting overflow: hidden on the viewport container.',
            'Z-index conflicts between panels resolved by layering active panel above others.',
          ]
        },
        { topic: 'Mobile responsiveness identified as next priority', timestamp: '11:50',
          bullets: [
            'Need to add responsive breakpoints for smaller screens.',
            'Consider gesture-based swiping for panel switching on touch devices.',
            'Agent panel integration planned for next deep work session.',
          ]
        },
      ],
      transcription: [
        { speaker: 'You', time: '10:02', text: 'Alright, let me start by setting up the panel container with a 150% width track.' },
        { speaker: 'You', time: '10:15', text: 'The translateX approach is working. Phase toggle slides between 0 and -33.33%.' },
        { speaker: 'You', time: '10:32', text: 'Found an overflow issue during transitions — panels are bleeding outside the viewport.' },
        { speaker: 'You', time: '10:45', text: 'Fixed it. Setting overflow: hidden on the viewport container clips the off-screen panels.' },
        { speaker: 'You', time: '11:10', text: 'Notes panel is now the persistent anchor. It stays visible in both phases.' },
        { speaker: 'You', time: '11:30', text: 'Adding the calendar panel grid layout. Seven columns for the week view.' },
        { speaker: 'You', time: '11:50', text: 'Good progress. Three panels sliding smoothly. Need to handle the agent panel next session.' },
      ],
      actionItems: [
        {
          person: 'You',
          tasks: [
            { text: 'Add responsive breakpoints for mobile screens and test at common widths', timestamp: '10:05', done: false },
            { text: 'Implement gesture-based swiping for panel switching on touch devices', timestamp: '11:50', done: false },
            { text: 'Fix z-index conflicts between overlapping panels during transitions', timestamp: '10:45', done: true },
            { text: 'Set up the panel container with 150% width track and translateX mechanism', timestamp: '10:05', done: true },
            { text: 'Handle agent panel integration in the next deep work session', timestamp: '11:50', done: false },
          ]
        },
      ]
    },
    {
      id: 'MF-12', title: 'AI Integration Brainstorm', time: '14:30', endTime: '15:30', colorIndex: 2,
      tags: ['AI', 'brainstorm', 'agent'],
      attendees: ['Priya', 'Raj'],
      aiSummary: 'Explored how the agent panel could leverage conversation context from notes and calendar events. Discussed real-time AI summaries, auto-linking, and contextual awareness across all three panels.',
      notesTitle: 'AI Integration Strategy',
      notesSummary: 'Explored how the agent panel could leverage full context from notes and calendar events for intelligent assistance, auto-summarization, and smart linking.',
      topicNotes: [
        { topic: 'Agent should have full calendar and notes context', timestamp: '14:35',
          bullets: [
            'When a user asks about their day, the agent pulls from both calendar events and linked notes.',
            'Context window should include today\'s schedule, recent notes, and active tasks.',
            'Privacy controls needed — user should choose what context the agent can access.',
          ]
        },
        { topic: 'End-of-day auto-summarization pipeline discussed', timestamp: '14:48',
          bullets: [
            'AI generates daily summaries by combining meeting notes, events, and agent conversations.',
            'These summaries become AI-authored notes automatically linked to the date.',
            'Weekly rollup summaries also proposed for sprint retrospectives.',
          ]
        },
        { topic: 'Bidirectional smart linking between notes and events', timestamp: '14:55',
          bullets: [
            'When a user writes a note mentioning a meeting topic, auto-suggest linking to the event.',
            'Semantic matching using embeddings to find relevant connections.',
            'Links should be bidirectional — navigable from both notes and calendar.',
          ]
        },
      ],
      transcription: [
        { speaker: 'You', time: '14:32', text: 'So the main question is — how deep should the AI integration go?' },
        { speaker: 'Priya', time: '14:35', text: 'I think the agent should have full context of today\'s calendar and linked notes.' },
        { speaker: 'You', time: '14:40', text: 'Right. So when someone asks "what did I do today", it pulls from both.' },
        { speaker: 'Raj', time: '14:48', text: 'We should also auto-generate end-of-day summaries. Combine meetings, notes, and chats.' },
        { speaker: 'Priya', time: '14:55', text: 'And smart linking — if a note mentions a meeting topic, auto-suggest the link.' },
        { speaker: 'You', time: '15:10', text: 'Love it. Let me spec this out. Bidirectional linking is the key insight.' },
      ],
      actionItems: [
        {
          person: 'You',
          tasks: [
            { text: 'Spec out the context-aware agent architecture with full calendar and notes access', timestamp: '14:40', done: false },
            { text: 'Create the agent context API endpoint for feeding calendar and notes data', timestamp: '15:10', done: false },
          ]
        },
        {
          person: 'Priya',
          tasks: [
            { text: 'Research embedding models for semantic note matching and cross-linking', timestamp: '14:55', done: false },
            { text: 'Design the smart linking UI/UX for bidirectional note-event connections', timestamp: '14:55', done: false },
          ]
        },
        {
          person: 'Raj',
          tasks: [
            { text: 'Build the auto-summarization pipeline prototype for end-of-day summaries', timestamp: '14:48', done: false },
          ]
        },
      ]
    },
    {
      id: 'MF-12c', title: 'Sprint Review', time: '16:00', endTime: '17:00', colorIndex: 5,
      tags: ['sprint', 'review'],
      attendees: ['Jason', 'Sarah', 'Mike', 'Priya'],
      aiSummary: 'Reviewed sprint progress with the full team. Calendar MVP and notes scaffolding were delivered on time. The agent panel backend resource gap was flagged as a risk for next sprint.',
      notesTitle: 'Sprint Review — Week 2 Wrap',
      notesSummary: 'Full team review of sprint deliverables. Calendar MVP and notes scaffolding shipped on time. Agent panel backend flagged as carry-over risk.',
      topicNotes: [
        { topic: 'All calendar and notes deliverables shipped on time', timestamp: '16:05',
          bullets: [
            'Calendar panel shipped — monthly grid view, then redesigned to Google Calendar style.',
            'Notes panel delivered with human/AI tab split and expandable card system.',
            'Phase toggle mechanism working smoothly between Calendar & Notes and Notes & Agent views.',
          ]
        },
        { topic: 'Agent panel backend is the main carry-over item', timestamp: '16:25',
          bullets: [
            'Frontend is fully mocked with session sidebar and chat interface.',
            'Backend API integration not yet started — needs dedicated resources.',
            'Currently using mock data for agent sessions and messages.',
          ]
        },
        { topic: 'Sprint velocity trending upward at 34 story points', timestamp: '16:40',
          bullets: [
            '34 story points completed, up 12% from previous sprint.',
            'Team capacity at 90% next sprint due to planned PTO.',
            'Velocity trend is positive — team is hitting stride on the Mindflow project.',
          ]
        },
      ],
      transcription: [
        { speaker: 'Jason', time: '16:02', text: 'Let\'s review what we shipped this sprint.' },
        { speaker: 'Sarah', time: '16:05', text: 'Calendar MVP is done — monthly grid, then redesigned to day view.' },
        { speaker: 'Mike', time: '16:10', text: 'Notes panel shipped with human/AI split. Expandable cards working.' },
        { speaker: 'You', time: '16:15', text: 'Phase toggle is smooth. Three-panel layout is the core feature this sprint.' },
        { speaker: 'Jason', time: '16:25', text: 'What about the agent panel?' },
        { speaker: 'You', time: '16:28', text: 'Frontend is mocked. Backend API isn\'t ready yet — that\'s the carry over.' },
        { speaker: 'Jason', time: '16:40', text: '34 points done. Good velocity. Let\'s keep it up.' },
      ],
      actionItems: [
        {
          person: 'Jason',
          tasks: [
            { text: 'Plan next sprint scope and allocate dedicated resources for agent backend', timestamp: '16:40', done: false },
          ]
        },
        {
          person: 'You',
          tasks: [
            { text: 'Ship the agent panel backend API and replace mock data with real API calls', timestamp: '16:28', done: false },
          ]
        },
        {
          person: 'Sarah',
          tasks: [
            { text: 'Prepare calendar MVP demo for stakeholder review by Friday', timestamp: '16:05', done: true },
          ]
        },
        {
          person: 'Mike',
          tasks: [
            { text: 'Finalize the notes panel human/AI split and hand off to QA', timestamp: '16:10', done: true },
          ]
        },
      ]
    },
  ],
  '2026-04-10': [
    { id: 'MF-13', title: 'Update API Integration', time: '9:00', endTime: '10:30', colorIndex: 3 },
    { id: 'MF-13b', title: 'Build Three-Panel Layout', time: '11:00', endTime: '12:30', colorIndex: 4 },
    { id: 'MF-13c', title: 'Product Sync', time: '14:00', endTime: '15:00', colorIndex: 2 },
  ],
  '2026-04-11': [
    { id: 'MF-14', title: 'Testing & QA Session', time: '10:00', endTime: '11:30', colorIndex: 1 },
    { id: 'MF-14b', title: 'Documentation Review', time: '13:00', endTime: '14:00', colorIndex: 6 },
    { id: 'MF-14c', title: 'Deploy to Staging', time: '15:30', endTime: '16:30', colorIndex: 5 },
  ],
  '2026-04-12': [
    { id: 'MF-15', title: 'Weekend Planning', time: '10:00', endTime: '10:30', colorIndex: 7 },
  ],
  '2026-04-13': [
    { id: 'MF-16', title: 'Adjust Responsive Layout', time: '11:00', endTime: '12:30', colorIndex: 4 },
    { id: 'MF-16b', title: 'Team Retro', time: '14:00', endTime: '15:00', colorIndex: 0 },
  ],
  '2026-04-14': [
    { id: 'MF-17', title: 'Enhance Error Handling', time: '9:00', endTime: '10:30', colorIndex: 1 },
    { id: 'MF-18', title: 'Review Code Quality', time: '15:00', endTime: '16:00', colorIndex: 3 },
  ],
  '2026-04-15': [
    { id: 'MF-19', title: 'Fix Navigation Issues', time: '10:00', endTime: '11:30', colorIndex: 1 },
    { id: 'MF-19b', title: 'Design Review', time: '14:00', endTime: '15:00', colorIndex: 2 },
  ],
  '2026-04-16': [
    { id: 'MF-20', title: 'Sprint Planning', time: '9:30', endTime: '11:00', colorIndex: 0 },
    { id: 'MF-20b', title: 'Backend Sync', time: '13:00', endTime: '14:00', colorIndex: 5 },
  ],
  '2026-04-17': [
    { id: 'MF-21', title: 'Update State Management', time: '9:00', endTime: '10:30', colorIndex: 4 },
    { id: 'MF-21b', title: 'UX Research Review', time: '14:00', endTime: '15:30', colorIndex: 6 },
  ],
  '2026-04-18': [
    { id: 'MF-22', title: 'Performance Optimization', time: '10:00', endTime: '12:00', colorIndex: 3 },
  ],
  '2026-04-20': [
    { id: 'MF-23', title: 'Weekly Sprint Review', time: '10:00', endTime: '11:00', colorIndex: 0 },
    { id: 'MF-23b', title: 'Client Demo Prep', time: '14:00', endTime: '15:30', colorIndex: 2 },
  ],
  '2026-04-22': [
    { id: 'MF-24', title: 'Implement Search Feature', time: '9:00', endTime: '11:00', colorIndex: 4 },
    { id: 'MF-24b', title: 'Team Lunch', time: '12:00', endTime: '13:00', colorIndex: 7 },
  ],
}

// Day summaries for when user clicks a date
export const calendarEvents = {
  '2026-04-01': {
    meetings: [
      { time: '10:00 AM', title: 'Product Sync with Team', summary: 'Discussed Q2 roadmap priorities. Agreed to focus on AI calendar integration first.', attendees: ['Sarah', 'Mike', 'Jason'] },
    ],
    aiSummary: 'You started the month energized. Main focus was aligning the team on Q2 goals. You felt optimistic about the new AI features and sketched initial wireframes during lunch.',
    mood: 'optimistic',
    linkedNotes: [1],
  },
  '2026-04-02': {
    meetings: [
      { time: '9:00 AM', title: 'Design Review', summary: 'Reviewed calendar UI mockups. Team loved the clean theme direction.', attendees: ['Design Team'] },
      { time: '2:00 PM', title: 'Engineering Standup', summary: 'Backend team started API scaffolding for calendar events.', attendees: ['Engineering'] },
    ],
    aiSummary: 'A productive day with two key meetings. You were deeply focused on getting the design language right. Spent evening hours researching competitor calendar apps.',
    mood: 'focused',
    linkedNotes: [3],
  },
  '2026-04-09': {
    meetings: [
      { time: '10:00 AM', title: 'Morning Standup', summary: 'Shared progress on the three-panel layout. Team is on track.', attendees: ['Full Team'] },
      { time: '2:30 PM', title: 'AI Integration Brainstorm', summary: 'Explored how the agent panel could leverage conversation context from notes.', attendees: ['AI Team'] },
    ],
    aiSummary: 'Today you\'re building the actual app. Feeling excited about bringing the three-panel concept to life. The brainstorm session opened up possibilities for deep AI-notes integration.',
    mood: 'excited',
    linkedNotes: [9, 10],
  },
};

export const taskCategories = {
  feature: { color: '#10b981', bg: '#ecfdf5', icon: '⚡', label: 'Feature' },
  bug: { color: '#ef4444', bg: '#fef2f2', icon: '🐛', label: 'Bug' },
  review: { color: '#f59e0b', bg: '#fffbeb', icon: '📋', label: 'Review' },
  refactor: { color: '#8b5cf6', bg: '#f5f0ff', icon: '🔄', label: 'Refactor' },
  design: { color: '#ec4899', bg: '#fdf2f8', icon: '🎨', label: 'Design' },
  meeting: { color: '#3b82f6', bg: '#eff6ff', icon: '🤝', label: 'Meeting' },
  perf: { color: '#06b6d4', bg: '#ecfeff', icon: '⚙️', label: 'Performance' },
}

export const notes = [
  {
    id: 1,
    title: 'Product Vision',
    content: 'The app should feel like a second brain. Calendar gives temporal context, notes capture thoughts, and the agent connects everything intelligently.',
    date: '2026-04-01',
    author: 'human',
    tags: ['vision', 'product'],
  },
  {
    id: 2,
    title: 'AI Summary — Week 1 Themes',
    content: 'Based on your meetings and notes this week, your primary focus areas were: UI/UX design direction, team alignment on Q2 goals, and initial architecture decisions. You showed a pattern of deep afternoon focus sessions.',
    date: '2026-04-03',
    author: 'ai',
    tags: ['weekly', 'summary'],
  },
  {
    id: 3,
    title: 'Calendar Feature Ideas',
    content: '- Click any date to see AI-generated day summary\n- Mood indicators based on meeting sentiment\n- Auto-link notes to calendar dates\n- Weekly digest emails\n- Hover preview of summary on calendar cells',
    date: '2026-04-02',
    author: 'human',
    tags: ['features', 'calendar'],
  },
  {
    id: 4,
    title: 'AI Insight — Meeting Patterns',
    content: 'You tend to have the most productive meetings before noon. Your 1:1s generate the most actionable items. Consider blocking 2-4 PM for deep work — your calendar shows this slot is frequently interrupted.',
    date: '2026-04-05',
    author: 'ai',
    tags: ['insight', 'productivity'],
  },
  {
    id: 5,
    title: 'Notes Panel Design',
    content: 'Two tabs: Human Notes and AI Notes. Human notes have a warm indicator, AI notes have a cool/purple indicator. Both should be searchable and linkable to calendar dates.\n\nDifferentiation is KEY — users must instantly know who wrote what.',
    date: '2026-04-05',
    author: 'human',
    tags: ['design', 'notes'],
  },
  {
    id: 6,
    title: 'AI Reflection — Your Creative Process',
    content: 'Analyzing your notes over the past week, you tend to ideate best after meetings with diverse perspectives. The design jam on Apr 8 led to your most detailed notes.',
    date: '2026-04-08',
    author: 'ai',
    tags: ['reflection', 'creativity'],
  },
  {
    id: 7,
    title: 'Agent Panel Concepts',
    content: 'The agent should feel like Claude Code — session-based, with history on the left and chat on the right. It should be able to reference notes and calendar context naturally.',
    date: '2026-04-07',
    author: 'human',
    tags: ['agent', 'design'],
  },
  {
    id: 8,
    title: 'Sprint Retro Notes',
    content: 'What went well: async communication, design velocity.\nWhat to improve: more structured note-taking during meetings.\nAction item: integrate auto-transcription.',
    date: '2026-04-08',
    author: 'human',
    tags: ['retro', 'process'],
  },
  {
    id: 9,
    title: 'AI Analysis — Sprint Velocity',
    content: 'Your team completed 34 story points this sprint, up 12% from last sprint. The calendar MVP and notes scaffolding were delivered on time. Risk flag: the agent panel has no assigned backend resources yet.',
    date: '2026-04-09',
    author: 'ai',
    tags: ['sprint', 'analytics'],
  },
  {
    id: 10,
    title: 'Personal Reflection',
    content: 'Building something that combines temporal awareness (calendar) with knowledge capture (notes) and intelligent assistance (agent) feels right. This could genuinely change how I work.',
    date: '2026-04-09',
    author: 'human',
    tags: ['personal', 'motivation'],
  },
  {
    id: 11,
    title: 'Colab91 — Supplier Taxonomy Feature',
    content: 'Need hierarchical taxonomy system for supplier classification. 3 levels deep. AI should suggest categories based on supplier description.',
    date: '2026-04-06',
    author: 'human',
    tags: ['colab91', 'taxonomy', 'feature'],
  },
  {
    id: 12,
    title: 'Colab91 — LLM Evaluation System',
    content: 'Build evaluation pipeline: test prompts → run against multiple models → compare outputs → score accuracy. Need dashboard for results.',
    date: '2026-04-06',
    author: 'human',
    tags: ['colab91', 'llm-eval', 'feature'],
  },
  {
    id: 13,
    title: 'AI Summary — Colab91 Meeting',
    content: 'Key takeaways from the Colab91 deep-dive: 3 major features identified (taxonomy, LLM eval, classification). Timeline: 6 weeks.',
    date: '2026-04-06',
    author: 'ai',
    tags: ['colab91', 'summary'],
  },
];

export const agentSessions = [
  {
    id: 1,
    title: 'UI Architecture Planning',
    date: '2026-04-07',
    preview: 'State management for three-panel layout',
    messages: [
      { role: 'user', content: 'Help me think through the state management for the three-panel layout.' },
      { role: 'assistant', content: 'For a three-panel layout with phase-based visibility, I\'d recommend a simple approach:\n\n**State Structure:**\n- `activePhase`: "calendar-notes" or "notes-agent"\n- `selectedDate`: current calendar date\n- `activeNoteTab`: "human" or "ai"\n- `activeSession`: current agent session ID\n\nThe phase determines which two panels are visible. The middle panel (Notes) is always visible, creating continuity between phases.\n\nWant me to sketch out the component hierarchy?' },
      { role: 'user', content: 'Yes, and how should the panels animate when switching phases?' },
      { role: 'assistant', content: 'Here\'s what I\'d suggest:\n\n**Transition approach:**\nUse CSS `transform: translateX()` for the sliding effect. The three panels live in a container wider than the viewport. Phase switch slides the container left/right.\n\n**Component tree:**\n```\nApp\n├── Sidebar (icon nav)\n├── PhaseToggle\n└── PanelContainer\n    ├── CalendarPanel\n    ├── NotesPanel\n    └── AgentPanel\n```\n\nThe Notes panel acts as the anchor — it\'s always in view.' },
    ],
  },
  {
    id: 2,
    title: 'AI Calendar Integration',
    date: '2026-04-08',
    preview: 'How should AI generate daily summaries?',
    messages: [
      { role: 'user', content: 'How should the AI generate daily summaries from calendar events?' },
      { role: 'assistant', content: 'Here\'s a practical approach:\n\n**Data inputs per day:**\n1. Meeting titles, attendees, and notes\n2. User\'s own notes tagged to that date\n3. Previous day\'s context for continuity\n\n**Summary structure:**\n- **Headline**: One-sentence day characterization\n- **Key events**: Bulleted meeting summaries\n- **Mood/energy**: Inferred from meeting density and note sentiment\n- **Connections**: Links to related notes\n\nThe AI should write in second person ("You focused on...") to feel personal and reflective.' },
    ],
  },
  {
    id: 3,
    title: 'Notes Categorization',
    date: '2026-04-09',
    preview: 'Best UX for human vs AI notes',
    messages: [
      { role: 'user', content: 'Based on my notes from April 5-6, how should we differentiate human vs AI notes in the UI?' },
      { role: 'assistant', content: 'Looking at your notes from those dates, here\'s what I recommend:\n\n**Visual System:**\n- **Human notes**: Blue left accent border, pen icon, clean white card\n- **AI notes**: Purple left accent with subtle gradient background, sparkle icon, "AI Generated" badge\n\n**Key Principle:**\nAI notes should feel like a helpful companion, not a replacement. They augment your thinking — they don\'t override it.' },
    ],
  },
];
