import { Button, JellyDrip } from '../design-system/components.jsx';
import { REGISTER_HREF, SiteFooter, SiteHeader } from '../site.jsx';

export const metadata = {
  title: 'Page not found · PBJ',
};

export default function NotFound() {
  return (
    <div className="page page-plain">
      <JellyDrip className="page-drip" />
      <SiteHeader />
      <main className="plain-main nf">
        <div className="plain-inner">
          <div className="band-head">
            <p className="nf-code" aria-hidden="true">404</p>
            <p className="eyebrow">Page not found</p>
            <h1 className="display-l">This slice fell out of the sandwich.</h1>
            <p className="plain-lead">The link may be old or mistyped. Head back to the start, or register your team while you’re here.</p>
          </div>
          <div className="actions">
            <Button size="lg" href="/">Back to home</Button>
            <Button size="lg" variant="secondary" href={REGISTER_HREF}>Register your team</Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
