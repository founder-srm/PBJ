import 'server-only';

// Is a Google Drive link viewable by anyone with the link? We ask Drive as an anonymous visitor:
//   200                         → public
//   redirect to accounts.google → private (sign-in required: restricted, or limited to an organisation)
//   401 / 403                   → private
//   404                         → missing (wrong or deleted link)
//   anything else / network     → unknown (Google didn't answer clearly; don't block on it)
// No API key needed. Only the file or folder id from the link is sent to Google.

const PATTERNS = [
  { kind: 'file', re: /\/file\/d\/([\w-]{10,})/ },
  { kind: 'folder', re: /\/drive\/(?:u\/\d+\/)?folders\/([\w-]{10,})/ },
  { kind: 'file', re: /[?&]id=([\w-]{10,})/ },
];

export function parseDriveLink(url) {
  for (const { kind, re } of PATTERNS) {
    const m = String(url).match(re);
    if (m) return { kind, id: m[1] };
  }
  return null;
}

// → 'public' | 'private' | 'missing' | 'invalid' | 'unknown'
export async function checkDriveLink(url) {
  const link = parseDriveLink(url);
  if (!link) return 'invalid';
  const target = link.kind === 'folder'
    ? `https://drive.google.com/drive/folders/${link.id}`
    : `https://drive.google.com/file/d/${link.id}/view`;
  try {
    const res = await fetch(target, {
      redirect: 'manual',
      cache: 'no-store',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; link-check)' },
      signal: AbortSignal.timeout(6000),
    });
    if (res.status === 200) return 'public';
    if (res.status === 404) return 'missing';
    if (res.status === 401 || res.status === 403) return 'private';
    if (res.status >= 300 && res.status < 400) {
      return /accounts\.google\.com|ServiceLogin/i.test(res.headers.get('location') ?? '') ? 'private' : 'unknown';
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

// What to tell a team about their link.
export const DRIVE_MESSAGES = {
  private: 'This link isn’t public yet. In Google Drive, open Share, set General access to “Anyone with the link” (Viewer), then submit the link again.',
  missing: 'Google Drive can’t find this file. Check that you copied the whole link and the file hasn’t been deleted.',
  invalid: 'Paste the link to the video itself: in Google Drive, right-click the video → Share → Copy link.',
  unknown: 'We couldn’t check your link with Google Drive just now. Make sure General access is set to “Anyone with the link”.',
};
