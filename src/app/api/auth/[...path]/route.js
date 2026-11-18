import { auth } from '../../../../lib/auth/server.js';

// Proxies every auth request (sign-in, callbacks, session, sign-out) to Neon Auth.
export const { GET, POST, PUT, PATCH, DELETE } = auth.handler();
