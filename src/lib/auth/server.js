import 'server-only';
import { createNeonAuth } from '@neon/auth/next/server';

// One server-side auth instance: .handler() for the API route, .middleware() for src/proxy.js,
// and .getSession() for server components and actions.
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL,
  cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET },
});
