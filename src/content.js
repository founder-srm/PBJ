// Event facts in one place. Dates are tentative until Founders Club confirms them.
export const EVENT = {
  dates: '15–17 February 2027',
  startISO: '2027-02-15T09:00:00+05:30',
  fee: 200,
};

export const DAYS = [
  {
    label: 'DAY 1',
    date: '15 Feb',
    title: 'Pitch & invest',
    body: '90-second pitches in your room, then invest in other teams and start building.',
    items: [
      { time: '08:00', label: 'Check-in' },
      { time: '09:00', label: 'Inauguration' },
      { time: '10:30', label: 'Pitch & invest' },
      { time: '13:00', label: 'Build' },
    ],
  },
  {
    label: 'DAY 2',
    date: '16 Feb',
    title: 'Evaluate & launch',
    body: 'FC seniors judge every product. Then go out and win real users.',
    items: [
      { time: '08:00', label: 'Product link due' },
      { time: '09:00', label: 'Evaluation' },
      { time: '11:15', label: 'Get users' },
      { time: '16:15', label: 'Top 15 announced' },
    ],
  },
  {
    label: 'DAY 3',
    date: '17 Feb',
    title: 'Finals',
    body: 'The top 15 pitch to DEI. Winners are pre-incubated.',
    items: [
      { time: '09:00', label: 'Last push for users' },
      { time: '11:00', label: 'Finals' },
      { time: '13:45', label: 'Results' },
    ],
  },
];

export const FAQS = [
  { q: 'Do we get our ₹200 back?', a: 'It comes back as 100,000 Peanuts to invest and spend during the event. Peanuts are virtual and can never be exchanged for money.' },
  { q: 'Can first-years take part?', a: 'Yes. Most teams will be first-years, and AI and no-code tools are allowed for building.' },
  { q: 'How big can a team be?', a: 'Two to four members. The fee is per team, so every team starts with the same 100,000 Peanuts.' },
  { q: 'What counts as a user?', a: 'A student who signs in with their college account through your team’s PBJ link. Each person counts once, and participants don’t count.' },
  { q: 'Do we have to stay overnight?', a: 'No. The event runs within college hours each day. You can keep building at home after 5 PM.' },
];
