import { auth } from './lib/auth/server.js';

// Next 16 "proxy" (formerly middleware). Two jobs on these routes:
//  1. Finish Google sign-in: Neon Auth sends the user back here with a one-time verifier that is swapped for session cookies.
//  2. Send signed-out visitors to /login.
export default auth.middleware({ loginUrl: '/login' });

export const config = {
  matcher: ['/register', '/dashboard/:path*', '/admin/:path*', '/judge/:path*'],
};
