import { getViewer, homeFor } from '../../../lib/viewer.js';

export const dynamic = 'force-dynamic';

// Tells client components (navbar, hero) whether the visitor is signed in, already has a team, and where they belong
// (`home`: /dashboard, /register, /judge or /admin).
export async function GET() {
  const viewer = await getViewer();
  return Response.json(
    { signedIn: Boolean(viewer), registered: Boolean(viewer?.teamId), home: viewer ? homeFor(viewer) : null },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
