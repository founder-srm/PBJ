'use client';

import { useMemo, useState, useTransition } from 'react';
import { saveScores } from './actions.js';

// One number per criterion (0..max, halves allowed) plus private notes. Shows the running total out of 100,
// computed the same way as the database: weighted share of each criterion's maximum.
export default function ScoreForm({ roundId, teamId, criteria, saved, notes: savedNotes, disabled }) {
  const [values, setValues] = useState(() => Object.fromEntries(criteria.map((c) => [c.id, saved[c.id] ?? ''])));
  const [notes, setNotes] = useState(savedNotes);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, start] = useTransition();

  const parsed = useMemo(() => criteria.map((c) => {
    const raw = String(values[c.id]).trim();
    const n = raw === '' ? null : Number(raw);
    const ok = n !== null && Number.isFinite(n) && n >= 0 && n <= c.max && Math.round(n * 2) === n * 2;
    return { ...c, n, ok };
  }), [criteria, values]);
  const complete = parsed.every((c) => c.ok);
  const weights = criteria.reduce((a, c) => a + c.weight, 0);
  const total = complete ? Math.round((parsed.reduce((a, c) => a + (c.n / c.max) * c.weight, 0) / weights) * 10000) / 100 : null;

  function submit(e) {
    e.preventDefault();
    setDone('');
    const bad = parsed.find((c) => !c.ok);
    if (bad) return setError(`Give ${bad.name} a score from 0 to ${bad.max} (halves are fine).`);
    setError('');
    start(async () => {
      const res = await saveScores({ roundId, teamId, scores: Object.fromEntries(parsed.map((c) => [c.id, c.n])), notes });
      if (res?.error) setError(res.error);
      else setDone(`Saved. Your total: ${res.total} / 100.`);
    });
  }

  return (
    <form className="judge-form" onSubmit={submit} noValidate>
      <fieldset className="judge-criteria" disabled={disabled || busy}>
        <legend className="admin-sub">Score each criterion. Halves are fine.</legend>
        {parsed.map((c) => (
          <label key={c.id} className="judge-criterion">
            <span className="judge-criterion-head">
              <b>{c.name}</b>
              <span className="admin-sub">out of {c.max}{c.weight !== 1 ? ` · weight ×${c.weight}` : ''}</span>
            </span>
            {c.description ? <span className="admin-sub">{c.description}</span> : null}
            <input
              type="number" inputMode="decimal" min="0" max={c.max} step="0.5"
              value={values[c.id]} aria-invalid={values[c.id] !== '' && !c.ok ? 'true' : undefined}
              onChange={(e) => setValues({ ...values, [c.id]: e.target.value })}
            />
          </label>
        ))}
        <label className="judge-criterion judge-notes">
          <b>Notes (only you and organisers see these)</b>
          <textarea rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </fieldset>
      <div className="judge-submit">
        <p className="judge-total">{total == null ? 'Total: –' : `Total: ${total} / 100`}</p>
        <button className="admin-btn admin-btn-primary judge-save" type="submit" disabled={disabled || busy}>{busy ? 'Saving…' : 'Save scores'}</button>
      </div>
      {error ? <p className="pbj-field-error" role="alert">{error}</p> : null}
      {done ? <p className="admin-msg" role="status">{done}</p> : null}
    </form>
  );
}
