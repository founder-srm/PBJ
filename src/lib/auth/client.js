'use client';

import { createAuthClient } from '@neon/auth/next';

// Browser-side auth: useSession(), signIn.social(), signOut().
export const authClient = createAuthClient();
