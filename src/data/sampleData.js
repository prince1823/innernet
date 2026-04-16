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
    { id: 'MF-06', title: 'Colab91 Feature Deep-Dive', time: '10:00', endTime: '11:30', colorIndex: 2, tags: ['colab91', 'feature'], attendees: ['Tanuj', 'Priya'], project: 'colab91',
      aiSummary: 'Deep-dive into Colab91 feature requirements. Discussed supplier taxonomy, LLM evaluation pipeline, and classification system. Timeline set at 6 weeks.',
      workActivity: {
        filesChanged: [
          { name: 'docs/taxonomy-spec.md', additions: 84, deletions: 0 },
          { name: 'src/models/supplier.ts', additions: 42, deletions: 5 },
          { name: 'src/api/taxonomy.ts', additions: 31, deletions: 0 },
        ],
        tabs: ['VS Code — taxonomy-spec.md', 'Figma — Colab91 Wireframes', 'Notion — Sprint Board'],
        sites: ['github.com/colab91', 'figma.com', 'notion.so'],
      },
      topicNotes: [
        { topic: 'Supplier Taxonomy System', timestamp: '10:10', bullets: ['3-level hierarchical taxonomy', 'AI-suggested categories based on supplier description', 'Bulk import/export support'] },
        { topic: 'LLM Evaluation Pipeline', timestamp: '10:40', bullets: ['Test prompts against multiple models', 'Compare outputs and score accuracy', 'Dashboard for results visualization'] },
      ],
      transcription: [
        { speaker: 'You', time: '10:02', text: 'Let\'s go through the three main features for Colab91.' },
        { speaker: 'Tanuj', time: '10:05', text: 'Starting with supplier taxonomy — we need a hierarchical system, 3 levels deep.' },
        { speaker: 'Priya', time: '10:15', text: 'AI should auto-suggest categories. We can use embeddings for that.' },
      ],
      actionItems: [
        { person: 'You', tasks: [{ text: 'Spec out taxonomy data model', timestamp: '10:10', done: false }] },
        { person: 'Tanuj', tasks: [{ text: 'Set up LLM eval pipeline scaffolding', timestamp: '10:40', done: false }] },
      ]
    },
    { id: 'MF-07', title: 'Supplier Taxonomy Module', time: '14:00', endTime: '15:30', colorIndex: 4, tags: ['colab91', 'taxonomy'], project: 'colab91', attendees: ['Tanuj'],
      aiSummary: 'Worked on the supplier taxonomy module architecture. Decided on a tree structure with lazy-loaded children and search indexing.',
    },
  ],
  '2026-04-07': [
    { id: 'MF-08', title: 'Architecture Discussion', time: '9:00', endTime: '10:00', colorIndex: 0, tags: ['architecture'], attendees: ['Jason', 'Sarah'], project: 'innernet',
      aiSummary: 'Discussed overall Innernet architecture — three-panel layout, state management approach, and data flow patterns.',
    },
    { id: 'MF-08b', title: 'Team Standup', time: '11:00', endTime: '11:30', colorIndex: 2, tags: ['standup'], attendees: ['Jason', 'Sarah', 'Mike', 'Tanuj'], project: 'innernet' },
    { id: 'MF-08c', title: 'Colab91 Code Review', time: '14:00', endTime: '15:00', colorIndex: 3, tags: ['colab91', 'review'], attendees: ['Tanuj', 'Raj'], project: 'colab91',
      aiSummary: 'Reviewed initial Colab91 codebase — API layer and database schema. Found issues with query performance on taxonomy lookups.',
      workActivity: {
        filesChanged: [
          { name: 'src/api/taxonomy.ts', additions: 12, deletions: 34 },
          { name: 'src/db/queries.sql', additions: 8, deletions: 15 },
          { name: 'tests/taxonomy.test.ts', additions: 45, deletions: 0 },
        ],
        tabs: ['GitHub — PR #42 Review', 'VS Code — taxonomy.ts', 'Datadog — Query Performance'],
        sites: ['github.com/colab91/pull/42', 'app.datadog.com', 'postgresql.org/docs'],
      },
    },
    { id: 'MF-08d', title: 'DevOps Sync', time: '16:00', endTime: '16:45', colorIndex: 5, tags: ['devops'], attendees: ['Mike'], project: 'innernet' },
  ],
  '2026-04-08': [
    { id: 'MF-09', title: 'Improve App Performance', time: '9:00', endTime: '10:30', colorIndex: 0, summary: 'Profiling and optimization session.', tags: ['perf', 'optimization'], project: 'innernet',
      aiSummary: 'Profiling and optimization session. Identified render bottlenecks in the calendar grid and reduced re-renders by 60% with useMemo.',
      workActivity: {
        filesChanged: [
          { name: 'src/components/CalendarPanel.jsx', additions: 15, deletions: 42 },
          { name: 'src/hooks/useThrottle.js', additions: 22, deletions: 0 },
        ],
        tabs: ['Chrome DevTools — Performance', 'VS Code — CalendarPanel.jsx', 'React Profiler'],
        sites: ['localhost:5175', 'react.dev/reference/react/useMemo', 'web.dev/performance'],
      },
    },
    { id: 'MF-10', title: 'Design Jam — Notes UI', time: '13:00', endTime: '14:30', colorIndex: 1, summary: 'Collaborative session on the notes panel design.', tags: ['design', 'notes', 'UI'], attendees: ['Sarah', 'Tanuj'], project: 'innernet' },
    { id: 'MF-10b', title: 'Client Call', time: '15:00', endTime: '16:00', colorIndex: 3, summary: 'Demo\'d early prototype to client.', tags: ['client', 'demo'], attendees: ['Jason', 'Client Team'], project: 'colab91' },
  ],
  '2026-04-09': [
    {
      id: 'MF-12b', title: 'Morning Standup', time: '9:00', endTime: '9:30', colorIndex: 0,
      tags: ['standup', 'team'], project: 'innernet',
      attendees: ['Jason', 'Sarah', 'Mike'],
      aiSummary: 'The team shared progress updates on the three-panel layout implementation. All sprint items are on track. Two minor blockers were identified around state management, which the engineering lead will resolve by end of day.',
      notesTitle: 'Morning Standup Sync',
      notesSummary: 'Quick team sync covering sprint progress, blockers, and daily priorities for the Innernet app development.',
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
        { person: 'Jason', tasks: [{ text: 'Review the cross-panel state management approach and approve architecture', timestamp: '9:12', done: true }] },
        { person: 'Sarah', tasks: [{ text: 'Finalize calendar panel day-view styling and push to staging', timestamp: '9:02', done: true }, { text: 'Document the Google Calendar redesign decisions for the team wiki', timestamp: '9:05', done: true }] },
        { person: 'Mike', tasks: [{ text: 'Complete the AI/human tab split in the notes panel by end of day', timestamp: '9:05', done: true }] },
        { person: 'You', tasks: [{ text: 'Wire up event selection from calendar to notes panel with shared state', timestamp: '9:08', done: false }, { text: 'Fix the date/time mismatch between calendar events and note detail cards', timestamp: '9:13', done: true }] },
      ]
    },
    {
      id: 'MF-11', title: 'Build Three-Panel Layout', time: '10:00', endTime: '12:00', colorIndex: 4,
      tags: ['dev', 'frontend', 'layout'], project: 'innernet',
      attendees: ['You'],
      aiSummary: 'Deep work session focused on implementing the core three-panel sliding layout using CSS transforms. Successfully built the phase-based panel switching mechanism where Calendar & Notes and Notes & Agent views toggle smoothly.',
      workActivity: {
        filesChanged: [
          { name: 'src/components/PanelLayout.jsx', additions: 187, deletions: 23 },
          { name: 'src/components/PanelLayout.css', additions: 142, deletions: 8 },
          { name: 'src/App.jsx', additions: 34, deletions: 12 },
          { name: 'src/components/CalendarPanel.jsx', additions: 28, deletions: 15 },
          { name: 'src/components/NotesPanel.jsx', additions: 19, deletions: 6 },
        ],
        tabs: ['VS Code — PanelLayout.jsx', 'VS Code — PanelLayout.css', 'Chrome — localhost:5175', 'Chrome DevTools — Elements'],
        sites: ['localhost:5175', 'developer.mozilla.org/CSS/transform', 'css-tricks.com/snippets/css/a-guide-to-flexbox', 'stackoverflow.com'],
      },
      notesTitle: 'Three-Panel Layout Implementation',
      notesSummary: 'Deep work session focused on building the core sliding panel system using CSS transforms, with successful phase-based switching between Calendar & Notes and Notes & Agent views.',
      topicNotes: [
        { topic: 'Panel architecture finalized with CSS transform approach', timestamp: '10:05',
          bullets: ['Three panels sit in a 150% width track container that slides left/right.', 'Phase toggle shifts the track using translateX(0) and translateX(-33.33%).', 'Notes panel is always visible as the anchor between both phases, creating continuity.']
        },
        { topic: 'CSS Grid layout working for panel track', timestamp: '10:32',
          bullets: ['Each panel is 50% of viewport width within the track container.', 'Transition uses transform: translateX() with 0.3s ease for smooth sliding.', 'Overflow: hidden on viewport container clips off-screen panels during transition.']
        },
        { topic: 'Overflow and z-index issues resolved', timestamp: '10:45',
          bullets: ['Initial issue with panels bleeding outside viewport during transitions.', 'Fixed by setting overflow: hidden on the viewport container.', 'Z-index conflicts between panels resolved by layering active panel above others.']
        },
        { topic: 'Mobile responsiveness identified as next priority', timestamp: '11:50',
          bullets: ['Need to add responsive breakpoints for smaller screens.', 'Consider gesture-based swiping for panel switching on touch devices.', 'Agent panel integration planned for next deep work session.']
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
        { person: 'You', tasks: [
          { text: 'Add responsive breakpoints for mobile screens and test at common widths', timestamp: '10:05', done: false },
          { text: 'Implement gesture-based swiping for panel switching on touch devices', timestamp: '11:50', done: false },
          { text: 'Fix z-index conflicts between overlapping panels during transitions', timestamp: '10:45', done: true },
          { text: 'Set up the panel container with 150% width track and translateX mechanism', timestamp: '10:05', done: true },
          { text: 'Handle agent panel integration in the next deep work session', timestamp: '11:50', done: false },
        ] },
      ]
    },
    {
      id: 'MF-12', title: 'AI Integration Brainstorm', time: '14:30', endTime: '15:30', colorIndex: 2,
      tags: ['AI', 'brainstorm', 'agent'], project: 'innernet',
      attendees: ['Priya', 'Raj'],
      aiSummary: 'Explored how the agent panel could leverage conversation context from notes and calendar events. Discussed real-time AI summaries, auto-linking, and contextual awareness across all three panels.',
      workActivity: {
        filesChanged: [
          { name: 'docs/ai-integration-plan.md', additions: 67, deletions: 0 },
          { name: 'src/utils/contextBuilder.ts', additions: 23, deletions: 0 },
        ],
        tabs: ['Notion — AI Strategy', 'Google Docs — Agent Spec', 'VS Code — contextBuilder.ts'],
        sites: ['platform.openai.com/docs', 'docs.anthropic.com', 'notion.so'],
      },
      notesTitle: 'AI Integration Strategy',
      notesSummary: 'Explored how the agent panel could leverage full context from notes and calendar events for intelligent assistance, auto-summarization, and smart linking.',
      topicNotes: [
        { topic: 'Agent should have full calendar and notes context', timestamp: '14:35',
          bullets: ['When a user asks about their day, the agent pulls from both calendar events and linked notes.', 'Context window should include today\'s schedule, recent notes, and active tasks.', 'Privacy controls needed — user should choose what context the agent can access.']
        },
        { topic: 'End-of-day auto-summarization pipeline discussed', timestamp: '14:48',
          bullets: ['AI generates daily summaries by combining meeting notes, events, and agent conversations.', 'These summaries become AI-authored notes automatically linked to the date.', 'Weekly rollup summaries also proposed for sprint retrospectives.']
        },
        { topic: 'Bidirectional smart linking between notes and events', timestamp: '14:55',
          bullets: ['When a user writes a note mentioning a meeting topic, auto-suggest linking to the event.', 'Semantic matching using embeddings to find relevant connections.', 'Links should be bidirectional — navigable from both notes and calendar.']
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
        { person: 'You', tasks: [
          { text: 'Spec out the context-aware agent architecture with full calendar and notes access', timestamp: '14:40', done: false },
          { text: 'Create the agent context API endpoint for feeding calendar and notes data', timestamp: '15:10', done: false },
        ] },
        { person: 'Priya', tasks: [
          { text: 'Research embedding models for semantic note matching and cross-linking', timestamp: '14:55', done: false },
          { text: 'Design the smart linking UI/UX for bidirectional note-event connections', timestamp: '14:55', done: false },
        ] },
        { person: 'Raj', tasks: [{ text: 'Build the auto-summarization pipeline prototype for end-of-day summaries', timestamp: '14:48', done: false }] },
      ]
    },
    {
      id: 'MF-12c', title: 'Sprint Review', time: '16:00', endTime: '17:00', colorIndex: 5,
      tags: ['sprint', 'review'], project: 'innernet',
      attendees: ['Jason', 'Sarah', 'Mike', 'Priya'],
      aiSummary: 'Reviewed sprint progress with the full team. Calendar MVP and notes scaffolding were delivered on time. The agent panel backend resource gap was flagged as a risk for next sprint.',
      notesTitle: 'Sprint Review — Week 2 Wrap',
      notesSummary: 'Full team review of sprint deliverables. Calendar MVP and notes scaffolding shipped on time. Agent panel backend flagged as carry-over risk.',
      topicNotes: [
        { topic: 'All calendar and notes deliverables shipped on time', timestamp: '16:05',
          bullets: ['Calendar panel shipped — monthly grid view, then redesigned to Google Calendar style.', 'Notes panel delivered with human/AI tab split and expandable card system.', 'Phase toggle mechanism working smoothly between Calendar & Notes and Notes & Agent views.']
        },
        { topic: 'Agent panel backend is the main carry-over item', timestamp: '16:25',
          bullets: ['Frontend is fully mocked with session sidebar and chat interface.', 'Backend API integration not yet started — needs dedicated resources.', 'Currently using mock data for agent sessions and messages.']
        },
        { topic: 'Sprint velocity trending upward at 34 story points', timestamp: '16:40',
          bullets: ['34 story points completed, up 12% from previous sprint.', 'Team capacity at 90% next sprint due to planned PTO.', 'Velocity trend is positive — team is hitting stride on the Innernet project.']
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
        { person: 'Jason', tasks: [{ text: 'Plan next sprint scope and allocate dedicated resources for agent backend', timestamp: '16:40', done: false }] },
        { person: 'You', tasks: [{ text: 'Ship the agent panel backend API and replace mock data with real API calls', timestamp: '16:28', done: false }] },
        { person: 'Sarah', tasks: [{ text: 'Prepare calendar MVP demo for stakeholder review by Friday', timestamp: '16:05', done: true }] },
        { person: 'Mike', tasks: [{ text: 'Finalize the notes panel human/AI split and hand off to QA', timestamp: '16:10', done: true }] },
      ]
    },
  ],
  '2026-04-10': [
    { id: 'MF-13', title: 'Update API Integration', time: '9:00', endTime: '10:30', colorIndex: 3, project: 'innernet', tags: ['api'] },
    { id: 'MF-13b', title: 'Build Three-Panel Layout', time: '11:00', endTime: '12:30', colorIndex: 4, project: 'innernet', tags: ['layout'] },
    { id: 'MF-13c', title: 'Colab91 Product Sync', time: '14:00', endTime: '15:00', colorIndex: 2, project: 'colab91', tags: ['colab91', 'sync'], attendees: ['Tanuj', 'Raj'] },
  ],
  '2026-04-11': [
    { id: 'MF-14', title: 'Testing & QA Session', time: '10:00', endTime: '11:30', colorIndex: 1, project: 'innernet', tags: ['testing'] },
    { id: 'MF-14b', title: 'Documentation Review', time: '13:00', endTime: '14:00', colorIndex: 6, project: 'innernet', tags: ['docs'] },
    { id: 'MF-14c', title: 'Deploy to Staging', time: '15:30', endTime: '16:30', colorIndex: 5, project: 'innernet', tags: ['deploy'] },
  ],
  '2026-04-12': [
    { id: 'MF-15', title: 'Weekend Planning', time: '10:00', endTime: '10:30', colorIndex: 7, project: 'innernet', tags: ['planning'] },
  ],
  '2026-04-13': [
    { id: 'MF-16', title: 'Adjust Responsive Layout', time: '11:00', endTime: '12:30', colorIndex: 4, project: 'innernet', tags: ['layout', 'responsive'] },
    { id: 'MF-16b', title: 'Team Retro', time: '14:00', endTime: '15:00', colorIndex: 0, project: 'innernet', tags: ['retro'], attendees: ['Jason', 'Sarah', 'Mike', 'Tanuj'] },
  ],
  '2026-04-14': [
    { id: 'MF-17', title: 'Enhance Error Handling', time: '9:00', endTime: '10:30', colorIndex: 1, project: 'innernet', tags: ['error-handling'] },
    { id: 'MF-18', title: 'Colab91 Review Code Quality', time: '15:00', endTime: '16:00', colorIndex: 3, project: 'colab91', tags: ['colab91', 'review'], attendees: ['Tanuj'] },
  ],
  '2026-04-15': [
    { id: 'MF-19', title: 'Fix Navigation Issues', time: '10:00', endTime: '11:30', colorIndex: 1, project: 'innernet', tags: ['bugfix'] },
    { id: 'MF-19b', title: 'Design Review', time: '14:00', endTime: '15:00', colorIndex: 2, project: 'innernet', tags: ['design'], attendees: ['Sarah'] },
  ],
  '2026-04-16': [
    { id: 'MF-20', title: 'Sprint Planning', time: '9:30', endTime: '11:00', colorIndex: 0, project: 'innernet', tags: ['planning'], attendees: ['Jason', 'Sarah', 'Mike'] },
    { id: 'MF-20b', title: 'Backend Sync', time: '13:00', endTime: '14:00', colorIndex: 5, project: 'innernet', tags: ['backend'] },
  ],
  '2026-04-17': [
    { id: 'MF-21', title: 'Update State Management', time: '9:00', endTime: '10:30', colorIndex: 4, project: 'innernet', tags: ['state'] },
    { id: 'MF-21b', title: 'UX Research Review', time: '14:00', endTime: '15:30', colorIndex: 6, project: 'innernet', tags: ['ux', 'research'] },
  ],
  '2026-04-18': [
    { id: 'MF-22', title: 'Performance Optimization', time: '10:00', endTime: '12:00', colorIndex: 3, project: 'innernet', tags: ['perf'] },
  ],
  '2026-04-20': [
    { id: 'MF-23', title: 'Weekly Sprint Review', time: '10:00', endTime: '11:00', colorIndex: 0, project: 'innernet', tags: ['sprint'] },
    { id: 'MF-23b', title: 'Client Demo Prep', time: '14:00', endTime: '15:30', colorIndex: 2, project: 'colab91', tags: ['colab91', 'demo'], attendees: ['Jason', 'Tanuj'] },
  ],
  '2026-04-22': [
    { id: 'MF-24', title: 'Implement Search Feature', time: '9:00', endTime: '11:00', colorIndex: 4, project: 'innernet', tags: ['search'] },
    { id: 'MF-24b', title: 'Team Lunch', time: '12:00', endTime: '13:00', colorIndex: 7, project: 'innernet', tags: ['social'], attendees: ['Jason', 'Sarah', 'Mike', 'Tanuj', 'Priya', 'Raj'] },
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
  feature: { color: '#10b981', bg: '#ecfdf5', icon: 'feature', label: 'Feature' },
  bug: { color: '#ef4444', bg: '#fef2f2', icon: 'bug', label: 'Bug' },
  review: { color: '#f59e0b', bg: '#fffbeb', icon: 'review', label: 'Review' },
  refactor: { color: '#8b5cf6', bg: '#f5f0ff', icon: 'refactor', label: 'Refactor' },
  design: { color: '#ec4899', bg: '#fdf2f8', icon: 'design', label: 'Design' },
  meeting: { color: '#3b82f6', bg: '#eff6ff', icon: 'meeting', label: 'Meeting' },
  perf: { color: '#06b6d4', bg: '#ecfeff', icon: 'perf', label: 'Performance' },
}

export const initialQuickNotes = [
  { id: 'qn-1', type: 'quicknote', date: '2026-04-09', time: '08:00', content: 'Need to think about how the agent panel should handle context from both calendar and notes. Maybe a unified context API that merges both data sources?', createdAt: 1744171200000 },
  { id: 'qn-2', type: 'quicknote', date: '2026-04-09', time: '13:00', content: 'Lunch break idea: what if quick notes could be voice-recorded and auto-transcribed? Would make capturing thoughts much faster.', createdAt: 1744189200000 },
  { id: 'qn-3', type: 'quicknote', date: '2026-04-09', time: '15:30', content: 'The bidirectional linking idea from the brainstorm is really promising. Should prototype this weekend.', createdAt: 1744198200000 },
]

export const notes = [
  { id: 1, title: 'Product Vision', content: 'The app should feel like a second brain. Calendar gives temporal context, notes capture thoughts, and the agent connects everything intelligently.', date: '2026-04-01', author: 'human', tags: ['vision', 'product'] },
  { id: 2, title: 'AI Summary — Week 1 Themes', content: 'Based on your meetings and notes this week, your primary focus areas were: UI/UX design direction, team alignment on Q2 goals, and initial architecture decisions. You showed a pattern of deep afternoon focus sessions.', date: '2026-04-03', author: 'ai', tags: ['weekly', 'summary'] },
  { id: 3, title: 'Calendar Feature Ideas', content: '- Click any date to see AI-generated day summary\n- Mood indicators based on meeting sentiment\n- Auto-link notes to calendar dates\n- Weekly digest emails\n- Hover preview of summary on calendar cells', date: '2026-04-02', author: 'human', tags: ['features', 'calendar'] },
  { id: 4, title: 'AI Insight — Meeting Patterns', content: 'You tend to have the most productive meetings before noon. Your 1:1s generate the most actionable items. Consider blocking 2-4 PM for deep work — your calendar shows this slot is frequently interrupted.', date: '2026-04-05', author: 'ai', tags: ['insight', 'productivity'] },
  { id: 5, title: 'Notes Panel Design', content: 'Two tabs: Human Notes and AI Notes. Human notes have a warm indicator, AI notes have a cool/purple indicator. Both should be searchable and linkable to calendar dates.\n\nDifferentiation is KEY — users must instantly know who wrote what.', date: '2026-04-05', author: 'human', tags: ['design', 'notes'] },
  { id: 6, title: 'AI Reflection — Your Creative Process', content: 'Analyzing your notes over the past week, you tend to ideate best after meetings with diverse perspectives. The design jam on Apr 8 led to your most detailed notes.', date: '2026-04-08', author: 'ai', tags: ['reflection', 'creativity'] },
  { id: 7, title: 'Agent Panel Concepts', content: 'The agent should feel like Claude Code — session-based, with history on the left and chat on the right. It should be able to reference notes and calendar context naturally.', date: '2026-04-07', author: 'human', tags: ['agent', 'design'] },
  { id: 8, title: 'Sprint Retro Notes', content: 'What went well: async communication, design velocity.\nWhat to improve: more structured note-taking during meetings.\nAction item: integrate auto-transcription.', date: '2026-04-08', author: 'human', tags: ['retro', 'process'] },
  { id: 9, title: 'AI Analysis — Sprint Velocity', content: 'Your team completed 34 story points this sprint, up 12% from last sprint. The calendar MVP and notes scaffolding were delivered on time. Risk flag: the agent panel has no assigned backend resources yet.', date: '2026-04-09', author: 'ai', tags: ['sprint', 'analytics'] },
  { id: 10, title: 'Personal Reflection', content: 'Building something that combines temporal awareness (calendar) with knowledge capture (notes) and intelligent assistance (agent) feels right. This could genuinely change how I work.', date: '2026-04-09', author: 'human', tags: ['personal', 'motivation'] },
  { id: 11, title: 'Colab91 — Supplier Taxonomy Feature', content: 'Need hierarchical taxonomy system for supplier classification. 3 levels deep. AI should suggest categories based on supplier description.', date: '2026-04-06', author: 'human', tags: ['colab91', 'taxonomy', 'feature'] },
  { id: 12, title: 'Colab91 — LLM Evaluation System', content: 'Build evaluation pipeline: test prompts → run against multiple models → compare outputs → score accuracy. Need dashboard for results.', date: '2026-04-06', author: 'human', tags: ['colab91', 'llm-eval', 'feature'] },
  { id: 13, title: 'AI Summary — Colab91 Meeting', content: 'Key takeaways from the Colab91 deep-dive: 3 major features identified (taxonomy, LLM eval, classification). Timeline: 6 weeks.', date: '2026-04-06', author: 'ai', tags: ['colab91', 'summary'] },
];

export const agentSessions = [
  {
    id: 'feat-1', title: 'Implement Promises Feature', date: '2026-04-09', preview: 'Promise tracking system',
    messages: [
      { role: 'user', content: 'How should the promise status window look? I want to show what was planned vs what was actually done each day.' },
      { role: 'assistant', content: 'I\'d suggest a **split-pane view**: left side shows planned items from morning, right side shows actual completion status.\n\n**Color coding:**\n- Green for done\n- Amber for partial\n- Red for missed\n\nAdd a `fulfillment score` percentage at the top. This gives an instant visual read of how the day went.' },
      { role: 'user', content: 'Add a streak counter too — like how many consecutive days I hit my promises.' },
      { role: 'assistant', content: 'Done. Here\'s the updated plan:\n\n**Streak Counter:**\n- Tracks consecutive days of **80%+ fulfillment**\n- Resets if score drops below threshold\n- Shows a flame icon with streak count in the header\n\n**Doc summary section:**\n- Side-by-side comparison of planned vs actual\n- Collapsed by default, expandable per day\n\nI\'ve added the streak counter to bullet point #1 in your doc. Want me to also spec out the AI analysis patterns for bullet #3?' },
      { role: 'user', content: 'Yes, for the AI analysis — use a 7-day rolling average to detect patterns.' },
      { role: 'assistant', content: 'Updated bullet #3 in your doc. Here\'s what the AI analysis will do:\n\n**Pattern Detection:**\n- `7-day rolling average` for fulfillment score\n- Flag if you consistently over-promise on certain task types\n- Generate **weekly insight cards** (e.g. "You complete design tasks 90% of the time but coding tasks only 60%")\n\n**Data model:**\n- `promise { planned: string, status: done|partial|missed, category: string }`\n- `dailyScore: number` (0-100)\n- `streakCount: number`' },
    ],
  },
  {
    id: 'feat-2', title: 'Sync to Universe with Cloudflare Worker', date: '2026-04-09', preview: 'Cloudflare Worker sync setup',
    messages: [
      { role: 'user', content: 'How do I set up the Cloudflare Worker for syncing? I need it to sync local state to a cloud store.' },
      { role: 'assistant', content: 'Here\'s the setup:\n\n**Step 1: Scaffold**\n- Run `wrangler init innernet-sync`\n- Create a KV namespace: `wrangler kv:namespace create SYNC_STORE`\n\n**Step 2: Worker endpoint**\n- Expose `/sync` POST endpoint\n- Accepts a diff payload and applies it to KV\n- Returns conflict resolution if needed\n\n**Step 3: Auth**\n- Use Cloudflare Access for auth\n- JWT token validation in the worker\n\nI\'ve added the setup steps to your doc under bullet #1.' },
      { role: 'user', content: 'How should conflict resolution work between local and cloud state?' },
      { role: 'assistant', content: '**Conflict Resolution Strategy:**\n\n- **Last-write-wins** for simple fields (titles, descriptions)\n- **CRDT-based merge** for lists (bullets, logs)\n- **Timestamp comparison** with `updatedAt` on every field\n\n**Sync Protocol:**\n1. Client sends diff with local timestamps\n2. Worker compares with KV timestamps\n3. If conflict → return both versions with `conflictType`\n4. Client shows merge UI for manual resolution\n\nFor Colab91 integration, the worker can proxy requests to their API and keep a local cache in KV.' },
    ],
  },
  {
    id: 'feat-3', title: 'Multi-Agent Execution Engine', date: '2026-04-09', preview: 'Parallel agent sessions',
    messages: [
      { role: 'user', content: 'When I click "Implement All", I want each feature to get its own agent session running in parallel. How should this work?' },
      { role: 'assistant', content: 'Here\'s the architecture:\n\n**Spawning:**\n- "Implement All" iterates over `featureDocItems`\n- Each feature spawns an independent agent session\n- Sessions run in parallel, each in its own chat tab\n\n**Context per agent:**\n- Feature title + description + bullets\n- Any existing agent thread from the doc\n- Related calendar events (matched by project tag)\n\n**Result flow:**\n- Agent output → inserted back into doc under that feature\n- Highlighted with purple accent so you know it\'s AI-written\n- Each insertion logged in Activity panel with session ID' },
      { role: 'user', content: 'What about rate limiting? If there are 10 features we can\'t hit the API 10 times at once.' },
      { role: 'assistant', content: '**Concurrency control:**\n\n- Use a **semaphore** with `maxConcurrent: 3`\n- Queue remaining features, process as slots free up\n- Show progress in Activity panel: "Agent 1/4 running, 3 queued"\n\n**Batching strategy:**\n- Group features by project tag\n- Within a project, agents share context (reduces token usage)\n- Use `AbortController` to cancel if user navigates away\n\nThis keeps API costs manageable while still feeling parallel to the user.' },
    ],
  },
  {
    id: 'feat-4', title: 'Calendar Search & Filter', date: '2026-04-09', preview: 'Search by project or person',
    messages: [
      { role: 'user', content: 'I want to search #colab91 and see all meetings for that project. Also search by person name like "Tanuj".' },
      { role: 'assistant', content: '**Search implementation:**\n\n**By project tag:**\n- Parse `#` prefix → filter `calendarTasks` where `project === tag`\n- Show results grouped by date in a schedule view\n- Example: `#colab91` → shows Apr 6, 7, 8, 10 meetings\n\n**By person:**\n- Search `attendees` array across all events\n- "Tanuj" → shows every meeting where Tanuj was present\n- Also search `transcription.speaker` for deeper matches\n\n**UI:**\n- Search bar in calendar header (already exists)\n- Results replace the day view temporarily\n- Click any result to jump to that date/event' },
      { role: 'user', content: 'Can we add fuzzy matching? Sometimes I might type "tanu" instead of "Tanuj".' },
      { role: 'assistant', content: '**Fuzzy search:**\n\n- Use **Levenshtein distance** with threshold of 2\n- Also support prefix matching (`tan` → `Tanuj`)\n- For project tags, match against both tag name and project description\n\n**Implementation:**\n- Simple scoring: exact match (100) > prefix (80) > fuzzy (60)\n- Show results sorted by score\n- Highlight matched portion in results\n\nNo external library needed — a 20-line fuzzy matcher will handle this scale. Want me to write it?' },
    ],
  },
];

// Feature document items for the Document panel
export const featureDocItems = [
  {
    id: 'feat-1',
    title: 'Implement Promises Feature',
    status: 'in-progress',
    description: 'Build the promises tracking system that logs what was planned vs. what was actually done each day.',
    bullets: [
      'Window summary view showing daily promise status',
      'Doc summary comparing planned items vs actual completion',
      'AI-generated analysis of promise fulfillment patterns',
    ],
    aiSuggestions: [
      { id: 'ai-1', text: 'Consider adding a "promise streak" indicator to gamify daily commitment tracking.', accepted: false },
    ],
    agentSessionId: null,
    project: 'innernet',
  },
  {
    id: 'feat-2',
    title: 'Sync to Universe with Cloudflare Worker',
    status: 'planned',
    description: 'Set up Cloudflare Workers to sync local state to a cloud-based "Universe" data store.',
    bullets: [
      'Setup Cloudflare Worker endpoint',
      'Integration with project Colab91',
      'Real-time sync protocol with conflict resolution',
    ],
    aiSuggestions: [],
    agentSessionId: null,
    project: 'colab91',
  },
  {
    id: 'feat-3',
    title: 'Multi-Agent Execution Engine',
    status: 'planned',
    description: 'Allow multiple AI agents to work on different features in parallel, each in their own chat window.',
    bullets: [
      'Each feature triggers a separate agent session',
      'Agent receives feature doc content as input/context',
      'Results are logged and inserted back into the document',
    ],
    aiSuggestions: [],
    agentSessionId: null,
    project: 'innernet',
  },
  {
    id: 'feat-4',
    title: 'Calendar Search & Filter',
    status: 'planned',
    description: 'Search by #project name or person name to find all related meetings.',
    bullets: [
      'Search #colab91 to see all Colab91 meetings',
      'Search "Tanuj" to see all meetings with Tanuj',
      'Results grouped by date in schedule view',
    ],
    aiSuggestions: [],
    agentSessionId: null,
    project: 'innernet',
  },
];

// Journal pages — date-keyed nested blocks for the Document panel (Logseq-style)
export const journalPages = {
  '2026-04-07': [
    {
      id: 'j0407-1', text: 'Kickoff: Innernet v1 planning', children: [
        { id: 'j0407-1a', text: 'Core idea — a personal OS that connects calendar, documents, and AI agents into one workspace', children: [] },
        {
          id: 'j0407-1b', text: 'Design pillars', children: [
            { id: 'j0407-1b1', text: 'Everything is a block — editable, nestable, linkable', children: [] },
            { id: 'j0407-1b2', text: 'AI is a collaborator, not a tool — it lives inside the doc', children: [] },
            { id: 'j0407-1b3', text: 'Time is the primary axis — calendar drives context', children: [] },
          ]
        },
      ]
    },
    {
      id: 'j0407-2', text: 'Decided on tech stack', children: [
        { id: 'j0407-2a', text: 'React + Vite for the frontend', children: [] },
        { id: 'j0407-2b', text: 'Cloudflare Workers for sync layer', children: [] },
        { id: 'j0407-2c', text: 'localStorage for now, migrate to IndexedDB later', children: [] },
      ]
    },
  ],

  '2026-04-08': [
    {
      id: 'j0408-1', text: 'Calendar panel prototype', children: [
        { id: 'j0408-1a', text: 'Built time-grid with 30min slots', children: [] },
        {
          id: 'j0408-1b', text: 'Event rendering', children: [
            { id: 'j0408-1b1', text: 'Color-coded by project tag', children: [] },
            { id: 'j0408-1b2', text: 'Click to expand with summary tab', children: [] },
            { id: 'j0408-1b3', text: 'Dynamic height calculation for overlapping events', children: [] },
          ]
        },
        { id: 'j0408-1c', text: 'Need to add mini-calendar dropdown for date navigation', children: [] },
      ]
    },
  ],

  '2026-04-09': [
    {
      id: 'j0409-1', text: 'Implement Promises Feature', children: [
        {
          id: 'j0409-1a', text: 'Core requirements', children: [
            { id: 'j0409-1a1', text: 'Window summary view showing daily promise status', children: [] },
            { id: 'j0409-1a2', text: 'Doc summary comparing planned items vs actual completion', children: [] },
            { id: 'j0409-1a3', text: 'AI-generated analysis of promise fulfillment patterns', children: [] },
          ]
        },
        { id: 'j0409-1b', text: 'Build the promises tracking system that logs what was planned vs what was actually done each day', children: [] },
        { id: 'j0409-1c', text: 'Consider adding a "promise streak" indicator to gamify daily commitment tracking', children: [] },
      ]
    },
    {
      id: 'j0409-2', text: 'Sync to Universe with Cloudflare Worker', children: [
        { id: 'j0409-2a', text: 'Setup Cloudflare Worker endpoint', children: [] },
        { id: 'j0409-2b', text: 'Integration with project #colab91', children: [] },
        {
          id: 'j0409-2c', text: 'Real-time sync protocol', children: [
            { id: 'j0409-2c1', text: 'Conflict resolution strategy — last-write-wins for now, CRDT later', children: [] },
            { id: 'j0409-2c2', text: 'WebSocket vs polling — leaning towards WebSocket for low latency', children: [] },
          ]
        },
      ]
    },
    {
      id: 'j0409-3', text: 'Morning standup notes', children: [
        { id: 'j0409-3a', text: 'Team agreed on semaphore pattern for agent concurrency (max 3)', children: [] },
        { id: 'j0409-3b', text: 'Tanuj to review calendar search prototype by end of day', children: [] },
      ]
    },
  ],

  '2026-04-10': [
    {
      id: 'j0410-1', text: 'Multi-Agent Execution Engine', children: [
        { id: 'j0410-1a', text: 'Each feature triggers a separate agent session', children: [] },
        { id: 'j0410-1b', text: 'Agent receives feature doc content as input/context', children: [] },
        {
          id: 'j0410-1c', text: 'Results pipeline', children: [
            { id: 'j0410-1c1', text: 'Results are logged to activity panel in real-time', children: [] },
            { id: 'j0410-1c2', text: 'Inserted back into the document as inline AI blocks', children: [] },
            { id: 'j0410-1c3', text: 'User can accept, edit, or dismiss each suggestion', children: [] },
          ]
        },
      ]
    },
    {
      id: 'j0410-2', text: 'Calendar Search & Filter', children: [
        { id: 'j0410-2a', text: 'Search #colab91 to see all Colab91 meetings', children: [] },
        { id: 'j0410-2b', text: 'Search "Tanuj" to see all meetings with Tanuj', children: [] },
        {
          id: 'j0410-2c', text: 'Implementation notes', children: [
            { id: 'j0410-2c1', text: 'Fuzzy matching with Levenshtein distance (threshold: 2)', children: [] },
            { id: 'j0410-2c2', text: 'Scoring: exact (100) > prefix (80) > fuzzy (60)', children: [] },
            { id: 'j0410-2c3', text: 'Results grouped by date in schedule view', children: [] },
          ]
        },
      ]
    },
  ],

  '2026-04-11': [
    {
      id: 'j0411-1', text: 'Weekly review', children: [
        {
          id: 'j0411-1a', text: 'What went well', children: [
            { id: 'j0411-1a1', text: 'Promises feature MVP is functional', children: [] },
            { id: 'j0411-1a2', text: 'Calendar panel UX feels solid', children: [] },
            { id: 'j0411-1a3', text: 'AI @mention integration working end-to-end', children: [] },
          ]
        },
        {
          id: 'j0411-1b', text: 'What needs improvement', children: [
            { id: 'j0411-1b1', text: 'Agent sessions sometimes hang — need timeout and retry logic', children: [] },
            { id: 'j0411-1b2', text: 'Document panel should feel more like an outliner (Logseq-style)', children: [] },
            { id: 'j0411-1b3', text: 'Need keyboard shortcuts for power users', children: [] },
          ]
        },
      ]
    },
    {
      id: 'j0411-2', text: 'Reading: "Tools for Thought" by Howard Rheingold', children: [
        { id: 'j0411-2a', text: 'The best tools disappear — they become extensions of how you think', children: [] },
        { id: 'j0411-2b', text: 'Innernet should feel like thinking out loud, not operating software', children: [] },
      ]
    },
  ],

  '2026-04-12': [
    {
      id: 'j0412-1', text: 'Thoughts on the spectrum model', children: [
        {
          id: 'j0412-1a', text: 'Most things in life exist on a spectrum, and to double down on one point of view when there are other ways of seeing things is limiting', children: [
            { id: 'j0412-1a1', text: 'Behaviours, normality, harm — all contextual', children: [] },
            {
              id: 'j0412-1a2', text: 'Some spectrums have balancing points, and some have tipping points', children: [
                { id: 'j0412-1a2a', text: 'Tipping points can be both for negative and positive change', children: [] },
                { id: 'j0412-1a2b', text: 'Balancing points are where equilibrium naturally settles', children: [] },
              ]
            },
          ]
        },
        { id: 'j0412-1b', text: 'Normal is relative, and the baseline is always shifting', children: [] },
      ]
    },
  ],

  '2026-04-13': [
    {
      id: 'j0413-1', text: 'Sunday — rest day', children: [
        { id: 'j0413-1a', text: 'Walked along the river, cleared my head', children: [] },
        {
          id: 'j0413-1b', text: 'Ideas that came up', children: [
            { id: 'j0413-1b1', text: 'What if the document panel was also a journal? Date-driven, like Logseq', children: [] },
            { id: 'j0413-1b2', text: 'Calendar events could auto-generate block stubs for meeting notes', children: [] },
            { id: 'j0413-1b3', text: 'The boundary between planning and reflecting should be blurry', children: [] },
          ]
        },
      ]
    },
  ],

  '2026-04-14': [
    {
      id: 'j0414-1', text: 'Shipping the outliner update today', children: [
        { id: 'j0414-1a', text: 'Document panel now renders as Logseq-style nested blocks', children: [] },
        { id: 'j0414-1b', text: 'Thread lines connect parent bullets to children', children: [] },
        { id: 'j0414-1c', text: 'Journal pages are date-keyed — selecting a date shows that day\'s blocks', children: [] },
      ]
    },
    {
      id: 'j0414-2', text: 'Next up', children: [
        { id: 'j0414-2a', text: 'Block collapsing/expanding (click bullet to toggle)', children: [] },
        { id: 'j0414-2b', text: 'Drag-and-drop reordering', children: [] },
        { id: 'j0414-2c', text: 'Block references — link to other blocks by ID', children: [] },
      ]
    },
  ],
};

// Activity logs for the Logs panel
export const activityLogs = [
  { id: 'log-1', time: '07:01', type: 'user', action: 'Opened Innernet app', session: null },
  { id: 'log-2', time: '07:02', type: 'user', action: 'Navigated to Calendar view', session: null },
  { id: 'log-3', time: '07:05', type: 'user', action: 'Clicked "Implement Promises Feature" in document', session: null },
  { id: 'log-4', time: '07:06', type: 'user', action: 'Clicked "Ask AI" on Feature 1', session: 'feat-1' },
  { id: 'log-5', time: '07:06', type: 'agent', action: 'Agent session started for "Implement Promises Feature"', session: 'feat-1' },
  { id: 'log-6', time: '07:07', type: 'agent', action: 'Brainstorming implementation approach...', session: 'feat-1' },
  { id: 'log-7', time: '07:08', type: 'agent', action: 'Extracted 3 to-do items from feature description', session: 'feat-1' },
  { id: 'log-8', time: '07:08', type: 'agent', action: 'Generated implementation prompt', session: 'feat-1' },
  { id: 'log-9', time: '07:09', type: 'user', action: 'Query: "make a plan on this — promises feature"', session: 'feat-1' },
  { id: 'log-10', time: '07:10', type: 'agent', action: 'LLM response received — suggested edits generated', session: 'feat-1' },
  { id: 'log-11', time: '07:11', type: 'user', action: 'Accepted AI suggested edits to document', session: 'feat-1' },
  { id: 'log-12', time: '07:11', type: 'system', action: 'Document updated with agent response', session: 'feat-1' },
  { id: 'log-13', time: '08:00', type: 'user', action: 'Clicked "Ask AI" on Feature 2 — Sync to Universe', session: 'feat-2' },
  { id: 'log-14', time: '08:00', type: 'agent', action: 'Agent session started for "Sync to Universe"', session: 'feat-2' },
  { id: 'log-15', time: '08:01', type: 'user', action: 'Asked AI to setup Cloudflare Worker', session: 'feat-2' },
  { id: 'log-16', time: '08:02', type: 'agent', action: 'AI response received — edited doc with Cloudflare setup steps', session: 'feat-2' },
  // Morning Standup 9:00–9:30
  { id: 'log-17', time: '09:00', type: 'user', action: 'Joined Morning Standup', session: null },
  { id: 'log-18', time: '09:01', type: 'user', action: 'Shared three-panel layout progress — 80% done', session: null },
  { id: 'log-19', time: '09:03', type: 'user', action: 'Flagged blocker: state management across panels', session: null },
  { id: 'log-20', time: '09:05', type: 'agent', action: 'Auto-captured action item: Sarah to finalize calendar styling', session: null },
  { id: 'log-21', time: '09:07', type: 'user', action: 'Discussed sprint velocity — on track for Thursday release', session: null },
  { id: 'log-22', time: '09:10', type: 'agent', action: 'Auto-captured action item: Mike to review cross-panel state', session: null },
  { id: 'log-23', time: '09:15', type: 'system', action: 'Meeting notes auto-saved to doc', session: null },
  { id: 'log-24', time: '09:20', type: 'user', action: 'Wrapped up standup — moved to deep work block', session: null },

  // Build Three-Panel Layout 10:00–12:00
  { id: 'log-25', time: '10:00', type: 'user', action: 'Opened three-panel layout workspace', session: 'feat-3' },
  { id: 'log-26', time: '10:02', type: 'user', action: 'Started CSS transform approach for panel sliding', session: 'feat-3' },
  { id: 'log-27', time: '10:05', type: 'agent', action: 'Suggested translateX-based phase switching pattern', session: 'feat-3' },
  { id: 'log-28', time: '10:08', type: 'user', action: 'Implemented phase 0: Calendar & Notes visible', session: 'feat-3' },
  { id: 'log-29', time: '10:15', type: 'user', action: 'Implemented phase 1: Notes & Agent visible', session: 'feat-3' },
  { id: 'log-30', time: '10:22', type: 'system', action: 'Hot reload — panel container set to 150% width', session: 'feat-3' },
  { id: 'log-31', time: '10:30', type: 'user', action: 'Fixed z-index conflict between overlapping panels', session: 'feat-3' },
  { id: 'log-32', time: '10:35', type: 'agent', action: 'Detected stacking context issue — recommended isolation', session: 'feat-3' },
  { id: 'log-33', time: '10:40', type: 'user', action: 'Applied isolation: isolate to panel wrapper', session: 'feat-3' },
  { id: 'log-34', time: '10:48', type: 'user', action: 'Added transition easing — 0.3s cubic-bezier', session: 'feat-3' },
  { id: 'log-35', time: '10:55', type: 'system', action: 'Build succeeded — no warnings', session: 'feat-3' },
  { id: 'log-36', time: '11:00', type: 'user', action: 'Testing toggle between Calendar/Notes and Notes/Agent', session: 'feat-3' },
  { id: 'log-37', time: '11:05', type: 'user', action: 'Found edge case: rapid toggling causes glitch', session: 'feat-3' },
  { id: 'log-38', time: '11:08', type: 'agent', action: 'Recommended debouncing phase switch — 150ms delay', session: 'feat-3' },
  { id: 'log-39', time: '11:12', type: 'user', action: 'Applied debounce fix — glitch resolved', session: 'feat-3' },
  { id: 'log-40', time: '11:20', type: 'user', action: 'Started responsive breakpoint work for mobile', session: 'feat-3' },
  { id: 'log-41', time: '11:30', type: 'agent', action: 'Generated media queries for 768px and 480px breakpoints', session: 'feat-3' },
  { id: 'log-42', time: '11:40', type: 'user', action: 'Tested on mobile viewport — panels stack vertically', session: 'feat-3' },
  { id: 'log-43', time: '11:48', type: 'system', action: 'Committed: "Set up panel container with 150% width transforms"', session: 'feat-3' },
  { id: 'log-44', time: '11:55', type: 'user', action: 'Pushed branch — ready for review', session: 'feat-3' },

  // AI Integration Brainstorm 14:30–15:30
  { id: 'log-45', time: '14:30', type: 'user', action: 'Opened AI integration brainstorm doc', session: 'feat-1' },
  { id: 'log-46', time: '14:32', type: 'user', action: 'Reviewed current Ask AI implementation', session: 'feat-1' },
  { id: 'log-47', time: '14:35', type: 'agent', action: 'Summarized 3 AI feature gaps from user feedback', session: 'feat-1' },
  { id: 'log-48', time: '14:40', type: 'user', action: 'Discussed inline editing vs sidebar AI approach', session: 'feat-1' },
  { id: 'log-49', time: '14:45', type: 'user', action: 'Decided on inline AI — less context switching', session: 'feat-1' },
  { id: 'log-50', time: '14:50', type: 'agent', action: 'Drafted inline AI component architecture proposal', session: 'feat-1' },
  { id: 'log-51', time: '14:58', type: 'user', action: 'Sketched streaming response UX — thinking dots pattern', session: 'feat-1' },
  { id: 'log-52', time: '15:05', type: 'system', action: 'Auto-saved brainstorm notes to feature doc', session: 'feat-1' },
  { id: 'log-53', time: '15:10', type: 'user', action: 'Assigned Sarah to build thinking dots animation', session: 'feat-1' },
  { id: 'log-54', time: '15:20', type: 'agent', action: 'Created follow-up tasks in sprint board', session: 'feat-1' },

  // Sprint Review 16:00–17:00
  { id: 'log-55', time: '16:00', type: 'user', action: 'Started Sprint Review — shared screen', session: null },
  { id: 'log-56', time: '16:02', type: 'user', action: 'Demo: three-panel layout sliding transitions', session: null },
  { id: 'log-57', time: '16:08', type: 'user', action: 'Demo: calendar panel redesign with Google Calendar style', session: null },
  { id: 'log-58', time: '16:12', type: 'agent', action: 'Auto-captured stakeholder feedback: "smooth transitions"', session: null },
  { id: 'log-59', time: '16:18', type: 'user', action: 'Demo: AI Ask feature with inline responses', session: null },
  { id: 'log-60', time: '16:25', type: 'user', action: 'Reviewed sprint burndown — 18/22 points completed', session: null },
  { id: 'log-61', time: '16:30', type: 'system', action: 'Sprint velocity calculated: 18 pts (avg: 16)', session: null },
  { id: 'log-62', time: '16:35', type: 'user', action: 'Discussed carry-over items: responsive breakpoints, gesture nav', session: null },
  { id: 'log-63', time: '16:42', type: 'agent', action: 'Generated sprint summary with completion stats', session: null },
  { id: 'log-64', time: '16:50', type: 'user', action: 'Approved sprint closure — moving to next sprint', session: null },
  { id: 'log-65', time: '16:55', type: 'system', action: 'Sprint report exported and shared with team', session: null },
];
