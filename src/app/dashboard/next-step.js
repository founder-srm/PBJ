// "What to do now" on the dashboard home, keyed by teams.status.
// Edit the copy here; the page renders whichever entry matches the team's status.
import { EVENT } from '../../content.js';

// Where teams submit their pitch-video Drive link (e.g. a Google Form).
// Leave empty until it's ready: the card then says the link is coming soon.
export const VIDEO_SUBMIT_URL = '';

export const NEXT_STEP = {
  registered: {
    title: 'Submit your 1‑minute pitch video',
    body: 'We use a short video to shortlist teams for PBJ.',
    steps: [
      'Record a video of up to 1 minute: who your team is and the idea you want to build.',
      'Upload it to Google Drive.',
      'Set sharing to “Anyone with the link can view”.',
      'Submit the link below. Shortlisted teams hear from us by email.',
    ],
    action: { label: 'Submit video link', href: VIDEO_SUBMIT_URL, pending: 'The submission link will appear here soon.' },
  },
  paid: {
    title: 'You’re in. See you at check-in',
    body: `Check-in opens at 08:00 on Day 1 (${EVENT.dates.split('–')[0]} Feb). Bring your college ID; every member must be there.`,
  },
  finalist: {
    title: 'You’re a finalist',
    body: 'Get your demo and final pitch ready. Your room lead will share the slot timings.',
  },
  winner: {
    title: 'You won PBJ',
    body: 'Congratulations. The Founders Club team will reach out about next steps.',
  },
  withdrawn: {
    title: 'Your team has withdrawn',
    body: 'If this is a mistake, contact the Founders Club team.',
  },
  disqualified: {
    title: 'Your team has been disqualified',
    body: 'Contact the Founders Club team if you have questions.',
  },
};
