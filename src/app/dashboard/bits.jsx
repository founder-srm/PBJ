'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// Re-renders the server page every `ms` (e.g. while waiting for Razorpay to confirm a payment).
export function AutoRefresh({ ms = 10000 }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), ms);
    return () => clearInterval(id);
  }, [router, ms]);
  return null;
}

// The team code with a copy button.
export function CopyCode({ code }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }
  return (
    <div className="dash-code">
      <code>{code}</code>
      <button type="button" className="pbj pbj-btn pbj-btn-secondary" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
    </div>
  );
}
