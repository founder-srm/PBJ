import '../design-system/tokens.css';
import '../design-system/components.css';
import '../styles.css';

export const metadata = {
  title: 'PBJ · Pitch, Build and Jump',
  description: 'A three-day startupathon by Founders Club, SRM: pitch, fund, build and prove that people want it. 15–17 February 2027.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#87ceeb' },
    { media: '(prefers-color-scheme: dark)', color: '#0e2240' },
  ],
};

// The design system styles dark mode with [data-theme="dark"]. This runs before first paint and mirrors the
// viewer's OS setting onto <html>, so there's no flash of the wrong theme.
const themeScript = `(function(){var m=window.matchMedia('(prefers-color-scheme: dark)');function a(){document.documentElement.dataset.theme=m.matches?'dark':'light'}a();m.addEventListener('change',a)})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400..700&family=Rubik:wght@400..800&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
