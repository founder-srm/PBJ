'use client';

import { useState, useTransition } from 'react';
import { Button, Field, Input } from '../../design-system/components.jsx';
import { pitchVideoSchema } from '../../lib/pitch.js';
import { submitPitchVideo } from './actions.js';

// Paste a Google Drive link to the pitch video. `current` is the saved link, if any (editable until the deadline).
export default function PitchVideoForm({ current }) {
  const [url, setUrl] = useState(current ?? '');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [saving, start] = useTransition();
  // The server checks with Google Drive that the link is public before saving.

  function submit(e) {
    e.preventDefault();
    setSaved('');
    const r = pitchVideoSchema.safeParse({ url });
    if (!r.success) return setError(r.error.issues[0].message);
    setError('');
    start(async () => {
      const res = await submitPitchVideo({ url });
      if (res?.error) setError(res.error);
      else setSaved(res.warning ? `Saved. ${res.warning}` : 'Saved. Your link is public, so judges can watch it.');
    });
  }

  return (
    <form className="dash-form" onSubmit={submit} noValidate>
      <Field label="Google Drive link" hint="Set sharing to “Anyone with the link can view”." error={error}>
        <Input type="url" inputMode="url" placeholder="https://drive.google.com/file/d/…" value={url} onChange={(e) => setUrl(e.target.value)} />
      </Field>
      <div className="dash-form-row">
        <Button type="submit" disabled={saving}>{saving ? 'Checking link…' : current ? 'Update link' : 'Submit video'}</Button>
        {saved ? <p className="note" role="status">{saved}</p> : null}
      </div>
    </form>
  );
}
