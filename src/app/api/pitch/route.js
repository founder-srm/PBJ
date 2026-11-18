import { getLiveState } from '../../../lib/live.js';
import { getViewer } from '../../../lib/viewer.js';

export const dynamic = 'force-dynamic';

// The signed-in team's live investing state (polled by the dashboard's invest panel).
export async function GET() {
  const viewer = await getViewer();
  if (!viewer?.teamId) return Response.json({ error: 'Not signed in to a team.' }, { status: 401 });
  const state = await getLiveState(viewer.teamId);
  return Response.json(state, { headers: { 'cache-control': 'no-store' } });
}
