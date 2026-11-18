// Divide teams across venues as evenly as possible. Pure, so it can be tested on its own.
// rooms: [{ id, name, n }] where n is how many teams each venue already has (pass 0s to start from empty).
// teamIds: teams to place, in the order they should be placed.
// Each team goes to the venue with the fewest teams (ties: first in `rooms` order).
// Returns { assignments: [{ teamId, roomId }], sizes: [{ id, name, n }] }.
export function divideEvenly(rooms, teamIds) {
  const sizes = rooms.map((r) => ({ id: r.id, name: r.name, n: r.n ?? 0 }));
  const assignments = [];
  if (!sizes.length) return { assignments, sizes };
  for (const teamId of teamIds) {
    const target = sizes.reduce((a, b) => (b.n < a.n ? b : a));
    target.n += 1;
    assignments.push({ teamId, roomId: target.id });
  }
  return { assignments, sizes };
}
