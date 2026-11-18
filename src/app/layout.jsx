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

// The design system styles dark mode with [data-theme="dark"]. This runs before first paint so there's no flash
// of the wrong theme. A choice made with the navbar toggle (ThemeToggle in src/site.jsx, saved as
// localStorage 'pbj-theme') wins; otherwise <html> mirrors the viewer's OS setting and follows it live.
const themeScript = `(function(){var m=window.matchMedia('(prefers-color-scheme: dark)');function s(){try{var v=localStorage.getItem('pbj-theme');return v==='light'||v==='dark'?v:null}catch(e){return null}}function a(){document.documentElement.dataset.theme=s()||(m.matches?'dark':'light')}a();m.addEventListener('change',a)})();`;

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
