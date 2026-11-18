'use client';

// Login for team leaders: Google, or email + password with a 6-digit verification code.
// Leaders use a personal email; SRM accounts can't sign in to third-party sites.
import { useState } from 'react';
import { Button, Field, Input } from '../design-system/components.jsx';
import { authClient } from '../lib/auth/client.js';
import { COLLEGE_DOMAIN } from '../lib/registration.js';

const AFTER_LOGIN = '/register'; // /register forwards to /dashboard once the team exists.
// The Neon client sometimes throws (e.g. AuthApiError on a wrong password) instead of returning { error }.
// Normalise both into { data, error } so every caller handles failures the same way.
async function call(fn) {
  try {
    const res = await fn();
    return { data: res?.data ?? null, error: res?.error ?? null };
  } catch (err) {
    return { data: null, error: { message: err?.message, code: err?.code ?? err?.body?.code, status: err?.status } };
  }
}

const isCollege = (email) => email.trim().toLowerCase().endsWith('@' + COLLEGE_DOMAIN);

function GoogleButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function go() {
    setBusy(true);
    setError('');
    const { error: err } = await call(() => authClient.signIn.social({ provider: 'google', callbackURL: AFTER_LOGIN }));
    if (err) {
      setError(err.message || 'Couldn’t reach Google. Try again.');
      setBusy(false);
    }
  }
  return (
    <div className="signin-actions">
      <button type="button" className="pbj-btn pbj-btn-lg google-btn" onClick={go} disabled={busy}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8Z" />
          <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23Z" />
          <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.2V7.2H2.1a11 11 0 0 0 0 9.8l3.7-2.8Z" />
          <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.2L5.8 10C6.7 7.3 9.1 5.4 12 5.4Z" />
        </svg>
        {busy ? 'Opening Google…' : 'Continue with Google'}
      </button>
      {error ? <p className="pbj-field-error" role="alert">{error}</p> : null}
    </div>
  );
}

export default function LoginPanel() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [step, setStep] = useState('form'); // 'form' | 'verify'
  const [v, setV] = useState({ name: '', email: '', password: '', code: '' });
  const [errs, setErrs] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const email = v.email.trim().toLowerCase();

  function check() {
    const x = {};
    if (mode === 'signup' && v.name.trim().length < 2) x.name = 'Enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) x.email = 'Enter a valid email address.';
    else if (isCollege(email)) x.email = `Use a personal email. @${COLLEGE_DOMAIN} accounts can’t sign in to third-party sites.`;
    if (v.password.length < 8) x.password = 'Passwords are at least 8 characters.';
    setErrs(x);
    return Object.keys(x).length === 0;
  }

  async function submit(e) {
    e.preventDefault();
    setMessage('');
    if (!check()) return;
    setBusy(true);
    if (mode === 'signup') {
      const { data, error } = await call(() => authClient.signUp.email({ name: v.name.trim(), email, password: v.password }));
      setBusy(false);
      if (error) return setMessage(error.message || 'Couldn’t create your account.');
      if (data?.user && !data.user.emailVerified) {
        setStep('verify');
        return setMessage(`We sent a 6-digit code to ${email}.`);
      }
      return (window.location.href = AFTER_LOGIN);
    }
    const { error } = await call(() => authClient.signIn.email({ email, password: v.password }));
    setBusy(false);
    if (error) {
      // Unverified accounts get a fresh code on sign-in; switch to the code step.
      if (error.code === 'EMAIL_NOT_VERIFIED' || /not verified/i.test(error.message || '')) {
        setStep('verify');
        return setMessage(`Verify your email first. We sent a 6-digit code to ${email}.`);
      }
      return setMessage(error.status === 401 || error.code === 'INVALID_EMAIL_OR_PASSWORD' || /invalid email or password/i.test(error.message || '') ? 'That email and password don’t match.' : error.message || 'Couldn’t sign in.');
    }
    window.location.href = AFTER_LOGIN;
  }

  async function verify(e) {
    e.preventDefault();
    const otp = v.code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(otp)) return setErrs({ code: 'Enter the 6-digit code from the email.' });
    setErrs({});
    setBusy(true);
    const { error } = await call(() => authClient.emailOtp.verifyEmail({ email, otp }));
    if (error) {
      setBusy(false);
      return setMessage(error.message || 'That code didn’t work. Check it or send a new one.');
    }
    // Verification signs the user in. If it didn't, sign in with the password they just typed.
    const { data } = await call(() => authClient.getSession());
    if (!data?.user) await call(() => authClient.signIn.email({ email, password: v.password }));
    window.location.href = AFTER_LOGIN;
  }

  async function resend() {
    setMessage('');
    const { error } = await call(() => authClient.emailOtp.sendVerificationOtp({ email, type: 'email-verification' }));
    setMessage(error ? error.message || 'Couldn’t send a new code.' : `New code sent to ${email}.`);
  }

  if (step === 'verify') {
    return (
      <form className="pbj pbj-reg signin-card" onSubmit={verify} noValidate>
        <div className="pbj-reg-head">
          <h3>Check your email</h3>
          <p>Enter the 6-digit code we sent to <strong>{email}</strong>. It expires in 15 minutes.</p>
        </div>
        <Field id="login-code" label="Verification code" error={errs.code}>
          <Input value={v.code} onChange={set('code')} inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="123456" />
        </Field>
        {message ? <p className="note" role="status">{message}</p> : null}
        <div className="signin-row">
          <Button type="submit" size="lg" disabled={busy}>{busy ? 'Verifying…' : 'Verify and continue'}</Button>
          <Button type="button" variant="ghost" onClick={resend}>Send a new code</Button>
          <Button type="button" variant="ghost" onClick={() => { setStep('form'); setMessage(''); }}>Use a different email</Button>
        </div>
      </form>
    );
  }

  return (
    <div className="pbj pbj-reg signin-card">
      <div className="signin-tabs" role="tablist" aria-label="Email login">
        <button type="button" role="tab" aria-selected={mode === 'signin'} onClick={() => { setMode('signin'); setErrs({}); setMessage(''); }}>Sign in</button>
        <button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => { setMode('signup'); setErrs({}); setMessage(''); }}>Create account</button>
      </div>
      <form className="signin-form" onSubmit={submit} noValidate>
        {mode === 'signup' ? (
          <Field id="login-name" label="Full name" error={errs.name}>
            <Input value={v.name} onChange={set('name')} autoComplete="name" maxLength={80} />
          </Field>
        ) : null}
        <Field id="login-email" label="Personal email" hint={`Not your @${COLLEGE_DOMAIN} address.`} error={errs.email}>
          <Input type="email" value={v.email} onChange={set('email')} autoComplete="email" placeholder="you@gmail.com" spellCheck={false} />
        </Field>
        <Field id="login-password" label="Password" hint={mode === 'signup' ? 'At least 8 characters.' : undefined} error={errs.password}>
          <Input type="password" value={v.password} onChange={set('password')} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
        </Field>
        {message ? <p className="pbj-field-error" role="alert">{message}</p> : null}
        <Button type="submit" size="lg" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}</Button>
      </form>
      <div className="signin-divider"><span>or</span></div>
      <GoogleButton />
    </div>
  );
}
