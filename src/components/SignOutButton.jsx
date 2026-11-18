'use client';

import { Button } from '../design-system/components.jsx';
import { authClient } from '../lib/auth/client.js';

export default function SignOutButton({ next = '/', label = 'Sign out', variant = 'secondary' }) {
  return (
    <Button variant={variant} onClick={async () => { await authClient.signOut(); window.location.href = next; }}>
      {label}
    </Button>
  );
}
