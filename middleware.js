// Locks the Website Manager (ag-admin.html) behind a password prompt.
// Password = the same editor code used for publishing (Vercel env var EDITOR_CODE).
// Username can be anything.
export const config = { matcher: ['/ag-admin.html', '/ag-admin'] };

export default function middleware(request) {
  const code = process.env.EDITOR_CODE;
  const auth = request.headers.get('authorization') || '';
  if (code && auth.startsWith('Basic ')) {
    try {
      const decoded = atob(auth.slice(6));
      const password = decoded.slice(decoded.indexOf(':') + 1);
      if (password === code) return; // allowed: continue to the page
    } catch (e) {}
  }
  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Assure Gold Admin", charset="UTF-8"',
      'X-Robots-Tag': 'noindex, nofollow',
      'Cache-Control': 'no-store'
    }
  });
}
