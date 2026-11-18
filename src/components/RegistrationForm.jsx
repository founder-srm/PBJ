'use client';

// Team registration: team details, then one card per member (member 1 is the leader).
// Validation comes from the shared Zod schema in src/lib/registration.js.
import { useState, useTransition } from 'react';
import { Badge, Button, Field, Input } from '../design-system/components.jsx';
import { registerTeam } from '../app/register/actions.js';
import { COLLEGE_DOMAIN, MAX_TEAM, MIN_TEAM, fieldErrors, registrationSchema } from '../lib/registration.js';

const blankMember = () => ({ name: '', raNumber: '', collegeEmail: '', phone: '', facultyAdvisor: '', facultyEmail: '' });
// The leader is the signed-in user (logged in with a personal email). Their name is prefilled; their SRM email is typed in.
const initial = (leader) => ({
  teamName: '',
  teamSize: '3',
  agree: false,
  members: Array.from({ length: MAX_TEAM }, (_, i) => (i === 0 ? { ...blankMember(), name: leader.name } : blankMember())),
});
const SIZES = Array.from({ length: MAX_TEAM - MIN_TEAM + 1 }, (_, i) => {
  const n = MIN_TEAM + i;
  return { value: String(n), label: `${n} members` };
});

// Only the first `teamSize` member slots are submitted; the rest keep their text in case the size goes back up.
const toPayload = (v) => ({ ...v, members: v.members.slice(0, Number(v.teamSize)) });
const fieldId = (key) => 'reg-' + key.replace(/\./g, '-');

export default function RegistrationForm({ fee = 200, leader }) {
  const [v, setV] = useState(() => initial(leader));
  const [errs, setErrs] = useState({});
  const [formError, setFormError] = useState('');
  const [tried, setTried] = useState(false);
  const [saving, startSaving] = useTransition();

  // After the first submit attempt, re-check on every change so errors clear as they're fixed.
  const update = (next) => {
    setV(next);
    if (tried) {
      const r = registrationSchema.safeParse(toPayload(next));
      setErrs(r.success ? {} : fieldErrors(r.error));
    }
  };
  const setTeam = (k) => (e) => update({ ...v, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const setMember = (i, k) => (e) => update({ ...v, members: v.members.map((m, j) => (j === i ? { ...m, [k]: e.target.value } : m)) });

  const showErrors = (fe) => {
    setErrs(fe);
    document.getElementById(fieldId(Object.keys(fe)[0]))?.focus();
  };

  function submit(e) {
    e.preventDefault();
    setTried(true);
    setFormError('');
    const r = registrationSchema.safeParse(toPayload(v));
    if (!r.success) return showErrors(fieldErrors(r.error));
    setErrs({});
    // On success the server action redirects to /dashboard; otherwise it returns errors to show here.
    startSaving(async () => {
      const res = await registerTeam(toPayload(v));
      if (res?.errors) showErrors(res.errors);
      if (res?.formError) setFormError(res.formError);
    });
  }

  const size = Number(v.teamSize);
  const err = (key) => errs[key];

  return (
    <form className="pbj pbj-reg reg-form" onSubmit={submit} noValidate>
      <div className="pbj-reg-head">
        <h3>Team details</h3>
        <p>Teams of {MIN_TEAM}–{MAX_TEAM}. ₹{fee} per team, returned as Peanuts. Fields marked optional can be left blank.</p>
      </div>

      <Field id={fieldId('teamName')} label="Team name" error={err('teamName')}>
        <Input value={v.teamName} onChange={setTeam('teamName')} placeholder="Night Owls" autoComplete="off" maxLength={40} />
      </Field>
      <Field id={fieldId('teamSize')} label="Team size" hint="Including the leader." error={err('teamSize')}>
        <Input as="select" value={v.teamSize} onChange={setTeam('teamSize')} options={SIZES} />
      </Field>

      {v.members.slice(0, size).map((m, i) => {
        const p = `members.${i}.`;
        const isLeader = i === 0;
        return (
          <fieldset key={i} className="wide reg-member">
            <legend>
              Member {i + 1}
              {isLeader ? <Badge tone="jelly">Team leader</Badge> : null}
            </legend>
            <div className="reg-grid">
              <Field id={fieldId(p + 'name')} label={isLeader ? 'Leader’s name' : 'Name'} error={err(p + 'name')}>
                <Input value={m.name} onChange={setMember(i, 'name')} autoComplete={isLeader ? 'name' : 'off'} maxLength={80} />
              </Field>
              <Field id={fieldId(p + 'raNumber')} label="Register number (RA)" error={err(p + 'raNumber')}>
                <Input value={m.raNumber} onChange={setMember(i, 'raNumber')} placeholder="RA2211003010123" autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={15} />
              </Field>
              <Field id={fieldId(p + 'collegeEmail')} label="College email" hint={isLeader ? `Your SRM email, for our records. You log in with ${leader.email}.` : undefined} error={err(p + 'collegeEmail')}>
                <Input type="email" value={m.collegeEmail} onChange={setMember(i, 'collegeEmail')} placeholder={`ab1234@${COLLEGE_DOMAIN}`} autoComplete="off" spellCheck={false} />
              </Field>
              <Field id={fieldId(p + 'phone')} label={<>Phone number <span className="opt">optional</span></>} error={err(p + 'phone')}>
                <Input type="tel" inputMode="tel" value={m.phone} onChange={setMember(i, 'phone')} placeholder="98765 43210" autoComplete={isLeader ? 'tel-national' : 'off'} maxLength={16} />
              </Field>
              <Field id={fieldId(p + 'facultyAdvisor')} label={<>Faculty advisor <span className="opt">optional</span></>} error={err(p + 'facultyAdvisor')}>
                <Input value={m.facultyAdvisor} onChange={setMember(i, 'facultyAdvisor')} autoComplete="off" maxLength={80} />
              </Field>
              <Field id={fieldId(p + 'facultyEmail')} label={<>Faculty advisor’s email <span className="opt">optional</span></>} error={err(p + 'facultyEmail')}>
                <Input type="email" value={m.facultyEmail} onChange={setMember(i, 'facultyEmail')} placeholder={`advisor@${COLLEGE_DOMAIN}`} autoComplete="off" spellCheck={false} />
              </Field>
            </div>
          </fieldset>
        );
      })}

      <div className="wide pbj-field">
        <label className="pbj-check">
          <input id={fieldId('agree')} type="checkbox" checked={v.agree} onChange={setTeam('agree')} aria-invalid={err('agree') ? 'true' : undefined} />
          I’ve read the PBJ rules. Peanuts are virtual and can’t be exchanged for money.
        </label>
        {err('agree') ? <span className="pbj-field-error" role="alert">{err('agree')}</span> : null}
      </div>
      <div className="wide reg-submit">
        <Button type="submit" size="lg" disabled={saving}>{saving ? 'Registering…' : 'Register team'}</Button>
        {formError ? <p className="pbj-field-error" role="alert">{formError}</p> : Object.keys(errs).length ? <p className="pbj-field-error" role="status">Fix the highlighted fields to continue.</p> : null}
      </div>
    </form>
  );
}
