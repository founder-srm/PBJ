// The "What to do now" card on the dashboard home: one panel per effective stage (see src/lib/stage.js).
// Server component; all dates come from event_schedule and are formatted in IST here.
import { Button, Countdown } from '../../design-system/components.jsx';
import { formatDate, formatDateTime } from '../../lib/event.js';
import { windowState } from '../../lib/stage.js';
import { AutoRefresh, CopyCode } from './bits.jsx';
import InvestPanel from './InvestPanel.jsx';
import PitchVideoForm from './PitchVideoForm.jsx';

// Badge shown under the team name.
export const STAGE_BADGE = {
  pitch_video: { tone: 'cloud', label: 'Registered · video due' },
  missed: { tone: 'cloud', label: 'Video not submitted' },
  in_review: { tone: 'cloud', label: 'Under review' },
  shortlisted: { tone: 'gain', label: 'Shortlisted · fee due' },
  not_shortlisted: { tone: 'cloud', label: 'Not shortlisted' },
  paid: { tone: 'gain', label: 'Paid · ready to play' },
  live: { tone: 'jelly', label: 'PBJ is live' },
  over: { tone: 'cloud', label: 'PBJ is over' },
  finalist: { tone: 'jelly', label: 'Finalist' },
  winner: { tone: 'jelly', label: 'Winner' },
  withdrawn: { tone: 'cloud', label: 'Withdrawn' },
  disqualified: { tone: 'cloud', label: 'Disqualified' },
};

function Card({ eyebrow = 'What to do now', title, body, children }) {
  return (
    <section className="pbj pbj-reg dash-card dash-next" aria-labelledby="dash-next-title">
      <div className="pbj-reg-head">
        <p className="dash-next-eyebrow">{eyebrow}</p>
        <h3 id="dash-next-title">{title}</h3>
        {body ? <p>{body}</p> : null}
      </div>
      {children ? <div className="wide dash-next-body">{children}</div> : null}
    </section>
  );
}

// videoAccess: result of checkDriveLink() for the saved video link (only checked while under review).
export default function HomeStage({ stage, team, schedule, settings, live, videoAccess }) {
  const s = schedule;
  switch (stage) {
    case 'pitch_video':
      return (
        <Card title="Submit your 90‑second pitch video" body={`We use it to shortlist teams. Submit by ${formatDateTime(s.pitch_video.endsAt)}.`}>
          <ol className="dash-next-steps">
            <li>Record a video of up to 90 seconds: your elevator pitch for the idea you want to build.</li>
            <li>Upload it to Google Drive and set sharing to “Anyone with the link can view”.</li>
            <li>Paste the link below.</li>
          </ol>
          <PitchVideoForm />
        </Card>
      );
    case 'missed':
      return <Card title="Video submissions have closed" body="Your team didn’t submit a pitch video in time, so it wasn’t considered for the shortlist." />;
    case 'in_review': {
      const open = windowState(s.pitch_video) === 'open';
      return (
        <Card title="Your pitch is under review" body={`Shortlist results are out on ${formatDateTime(s.results.startsAt)}. Check back then.`}>
          <p className="note">Your video: <a href={team.pitch_video_url} target="_blank" rel="noopener noreferrer">{team.pitch_video_url}</a></p>
          {videoAccess === 'private' || videoAccess === 'missing' ? (
            <p className="pbj-field-error dash-alert" role="alert">
              {videoAccess === 'private'
                ? 'Judges can’t open your video: the link isn’t public any more. In Google Drive, open Share and set General access to “Anyone with the link” (Viewer).'
                : 'Google Drive can’t find your video any more. Check the file still exists, or submit a new link.'}
            </p>
          ) : null}
          {open ? <PitchVideoForm current={team.pitch_video_url} /> : null}
        </Card>
      );
    }
    case 'not_shortlisted':
      return <Card title="You weren’t shortlisted this time" body="Thank you for pitching. We had far more strong teams than places. Keep building, and come back next year." />;
    case 'shortlisted': {
      const pay = windowState(s.payment);
      if (pay === 'closed') return <Card title="Payment has closed" body={`The entry fee was due by ${formatDateTime(s.payment.endsAt)}. Contact the Founders Club team if you’ve already paid.`} />;
      return (
        <Card title="You’re shortlisted. Pay the entry fee" body={`Pay ₹${settings.feeRupees} by ${formatDateTime(s.payment.endsAt)} to confirm your place. Your team gets ${settings.feeGrant.toLocaleString('en-US')} Peanuts as soon as the payment goes through.`}>
          <ol className="dash-next-steps">
            <li>Copy your team code. You’ll need to type it on the payment page.</li>
            <li>Pay ₹{settings.feeRupees} on the Razorpay page.</li>
            <li>Come back here: this page updates by itself once the payment is confirmed.</li>
          </ol>
          <CopyCode code={team.team_code} />
          {pay === 'upcoming'
            ? <p className="note">Payment opens on {formatDateTime(s.payment.startsAt)}.</p>
            : settings.razorpayPageUrl
              ? <Button href={settings.razorpayPageUrl} target="_blank" rel="noopener noreferrer">Pay ₹{settings.feeRupees}</Button>
              : <p className="note">The payment link will appear here soon.</p>}
          <AutoRefresh ms={10000} />
        </Card>
      );
    }
    case 'paid':
      return (
        <Card title={team.room ? `Your venue: ${team.room}` : 'You’re in. See you at PBJ'} body={`PBJ starts on ${formatDateTime(s.event.startsAt)}. Every member must check in with their college ID.`}>
          {team.room ? null : <p className="note">Your venue will appear here once it’s assigned.</p>}
          <Countdown to={s.event.startsAt.toISOString()} label="PBJ starts in" className="dash-countdown" />
        </Card>
      );
    case 'live':
      return (
        <Card eyebrow={live?.venue ? `Live · ${live.venue}` : 'Live'} title="Invest in the team on stage" body="Back the teams pitching in your venue. You can’t invest in a team that has invested in you.">
          <InvestPanel initial={live} />
        </Card>
      );
    case 'over':
      return <Card title="PBJ is over" body="Thanks for building with us. Results and the final leaderboard will be shared soon." />;
    case 'finalist':
      return <Card title="You’re a finalist" body="Get your demo and final pitch ready. Your venue lead will share the slot timings." />;
    case 'winner':
      return <Card title="You won PBJ" body="Congratulations. The Founders Club team will reach out about next steps." />;
    case 'withdrawn':
      return <Card title="Your team has withdrawn" body="If this is a mistake, contact the Founders Club team." />;
    case 'disqualified':
      return <Card title="Your team has been disqualified" body="Contact the Founders Club team if you have questions." />;
    default:
      return null;
  }
}

export function formatEventDates(s) {
  if (!s?.event) return '';
  return s.event.endsAt ? `${formatDate(s.event.startsAt).replace(/ \d{4}$/, '')} – ${formatDate(s.event.endsAt)}` : formatDate(s.event.startsAt);
}
