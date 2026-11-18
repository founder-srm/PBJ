# Verifying changes

There are no unit tests. Verify by building, then exercising the real thing. Start your own server; port 3000 is usually the owner's dev server, so don't kill it.

## 1. Build

```bash
npm run build          # must pass; it also lists each route as ○ static or ƒ dynamic
```

The home page and 404 should stay `○` (static). If `/` turns `ƒ`, something on it started reading cookies or the DB on the server.

## 2. Run the production build on your own port

```bash
npx next start -p 4790 &     # pick a free port; stop it when done: pkill -f "next start -p 4790"
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" localhost:4790/register   # 307 → /login when signed out
curl -s localhost:4790/api/me                                                       # {"signedIn":false,"registered":false}
```

## 3. Look at it: headless Chrome

Screenshots (desktop):

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars \
  --force-device-scale-factor=1 --window-size=1440,900 --virtual-time-budget=5000 \
  --screenshot=/tmp/shot.png http://localhost:4790/login
```

Headless windows can't go below ~500px wide. For phone widths, and for scripted interaction (filling forms, clicking, reading errors), drive Chrome over the DevTools protocol:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --remote-debugging-port=9333 \
  --user-data-dir="$(mktemp -d)" about:blank &
```

```js
// check.mjs: node check.mjs   (Node 22+: global WebSocket and fetch)
const [page] = (await (await fetch('http://127.0.0.1:9333/json/list')).json()).filter((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let n = 0; const waiting = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); waiting.get(m.id)?.(m); };
const send = (method, params = {}) => new Promise((r) => { const id = ++n; waiting.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const js = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.result.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
await send('Page.navigate', { url: 'http://localhost:4790/login' }); await sleep(2500);
console.log(await js(`document.documentElement.scrollWidth > innerWidth ? 'HORIZONTAL SCROLL' : 'fits'`));

// Typing into a React input: use the native setter, then dispatch 'input'.
const type = (sel, v) => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)});
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(v)});
  el.dispatchEvent(new Event('input', { bubbles: true })); })()`);

const shot = await send('Page.captureScreenshot', { format: 'png' });
(await import('node:fs')).writeFileSync('/tmp/phone.png', Buffer.from(shot.result.data, 'base64'));
ws.close();
```

Check every page you touched at **1440, 1024 and 390** wide, and look for console errors (`Runtime.enable`, then listen for `Runtime.exceptionThrown`). React error #418/#425 = hydration mismatch.

### Signed-in states without a real login

You can't complete Google or an email OTP headlessly. To test UI that depends on the session, intercept the two requests the client makes with `Fetch.enable` and answer them yourself:

- `*/api/auth/get-session*` → `null` (signed out) or `{ "session": {…}, "user": { "id", "name", "email", "emailVerified": true } }`
- `*/api/me*` → `{ "signedIn": true, "registered": true|false }`

Respond with `Fetch.fulfillRequest` (base64 body, `content-type: application/json`); `Fetch.continueRequest` everything else. Server-rendered pages (`/register`, `/dashboard`) can't be faked this way; test their SQL instead (below) and ask the owner to click through with a real account.

## 4. Test SQL without leaving data behind

Run a `DO` block through the Neon MCP `run_sql` tool that does the work, collects results and **raises an exception at the end**, so everything rolls back and the results come back in the error message:

```sql
do $$
declare out text[] := '{}'; t uuid;
begin
  begin
    set constraints all deferred;         -- deferred triggers fire at the next line, not at commit
    -- … inserts that should succeed or fail …
    set constraints all immediate;
    out := array_append(out, 'case 1: accepted');
  exception when others then out := array_append(out, 'case 1: rejected - ' || sqlerrm); end;
  raise exception E'RESULTS (rolled back):\n%', array_to_string(out, E'\n');
end $$;
```

Use `array_append`, not `out || 'text'` (Postgres reads the text as an array literal). Signed-in flows can be simulated by inserting a temporary `neon_auth."user"` row inside the block.

## 5. Report

Say what you ran and what you saw: build result, which pages and widths, which states, and anything you couldn't test (e.g. real Google sign-in).
