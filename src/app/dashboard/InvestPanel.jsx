'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Field, Input, PeanutAmount } from '../../design-system/components.jsx';
import { investInPitch } from './actions.js';

const POLL_MS = 5000;

// Live investing: shows who is pitching in the team's venue (polled from /api/pitch) and lets the team invest.
// `initial` is the server-rendered state from getLiveState().
export default function InvestPanel({ initial }) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, start] = useTransition();

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch('/api/pitch', { cache: 'no-store' });
        if (res.ok && alive) setState(await res.json());
      } catch {}
    };
    const id = setInterval(tick, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // A new pitch clears the last message.
  const pitchId = state?.pitch?.id;
  useEffect(() => { setDone(''); setError(''); }, [pitchId]);

  function submit(e) {
    e.preventDefault();
    setDone('');
    const n = Number(amount);
    if (!Number.isInteger(n) || n <= 0) return setError('Enter a whole number of Peanuts above zero.');
    if (n > state.budget.remaining) return setError('That’s more than you can invest right now.');
    setError('');
    start(async () => {
      const res = await investInPitch({ pitchId, amount: n, key: crypto.randomUUID() });
      if (res?.error) return setError(res.error);
      setDone(`Invested ${n.toLocaleString('en-US')} Peanuts in ${state.pitch.teamName}.`);
      setAmount('');
      try {
        const r = await fetch('/api/pitch', { cache: 'no-store' });
        if (r.ok) setState(await r.json());
      } catch {}
      router.refresh();
    });
  }

  if (!state) return null;
  const { pitch, budget } = state;
  return (
    <div className="dash-invest">
      <div className="dash-invest-now">
        <p className="dash-next-eyebrow">Pitching now</p>
        <p className="dash-invest-team">{pitch ? pitch.teamName : 'No one yet'}</p>
        {pitch && pitch.ours > 0 ? <p className="note">You’ve invested <PeanutAmount value={pitch.ours} size="sm" /> in them.</p> : null}
      </div>

      <dl className="dash-budget">
        <div><dt>Invested</dt><dd><PeanutAmount value={budget.used} size="sm" /></dd></div>
        <div><dt>Can still invest</dt><dd><PeanutAmount value={budget.remaining} size="sm" /></dd></div>
        <div><dt>Target</dt><dd><PeanutAmount value={budget.min} size="sm" /> to <PeanutAmount value={budget.max} size="sm" /></dd></div>
      </dl>

      {state.canInvest ? (
        <form className="dash-form" onSubmit={submit} noValidate>
          <Field label={`Invest in ${pitch.teamName}`} hint={`Up to ${budget.remaining.toLocaleString('en-US')} Peanuts.`} error={error}>
            <Input type="number" inputMode="numeric" min="1" step="1" max={budget.remaining} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5000" />
          </Field>
          <div className="dash-form-row">
            <Button type="submit" disabled={busy}>{busy ? 'Investing…' : 'Invest'}</Button>
            {done ? <p className="note" role="status">{done}</p> : null}
          </div>
        </form>
      ) : (
        <>
          <p className="note" role="status">{state.reason}</p>
          {done ? <p className="note" role="status">{done}</p> : null}
        </>
      )}
    </div>
  );
}
