import { z } from 'zod';

// The pitch-video link: a Google Drive URL. Shared by the dashboard form (client) and submitPitchVideo (server);
// the database CHECK on teams.pitch_video_url enforces the same prefix.
export const pitchVideoSchema = z.object({
  url: z.string().trim()
    .min(1, 'Paste the Google Drive link to your video.')
    .regex(/^https:\/\/drive\.google\.com\/\S+$/, 'Use a Google Drive link that starts with https://drive.google.com/.')
    .max(500, 'That link is too long.'),
});
