import { getViewer } from '../../../lib/viewer.js';

export const dynamic = 'force-dynamic';

// Tells client components (navbar, hero) whether the visitor is signed in and already has a team.
export async function GET() {
  const viewer = await getViewer();
  return Response.json(
    { signedIn: Boolean(viewer), registered: Boolean(viewer?.teamId) },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
