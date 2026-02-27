/**
 * Yahoo Finance cookie+crumb authentication helper.
 * Yahoo Finance v8 API requires a session cookie and crumb token for authentication.
 */

const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

let cachedCookie: string | null = null;
let cachedCrumb: string | null = null;
let cacheExpiry = 0;

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Obtains a Yahoo Finance session cookie and crumb token.
 * Results are cached for 5 minutes to reduce overhead.
 */
export async function getYahooAuth(): Promise<{ cookie: string; crumb: string }> {
    const now = Date.now();
    if (cachedCookie && cachedCrumb && now < cacheExpiry) {
        return { cookie: cachedCookie, crumb: cachedCrumb };
    }

    // Step 1: Get session cookie from fc.yahoo.com
    const sessionRes = await fetch('https://fc.yahoo.com', {
        redirect: 'manual',
        headers: { 'User-Agent': USER_AGENT },
    });

    // Parse Set-Cookie header — handle both getSetCookie() and fallback
    let cookieParts: string[] = [];
    const getSetCookie = (sessionRes.headers as Record<string, unknown>)['getSetCookie'];
    if (typeof getSetCookie === 'function') {
        cookieParts = (getSetCookie.call(sessionRes.headers) as string[]).map(
            (c: string) => c.split(';')[0]
        );
    } else {
        const raw = sessionRes.headers.get('set-cookie') ?? '';
        // Split on commas that are NOT followed by space+digit (avoids splitting dates like "Thu, 01")
        cookieParts = raw
            .split(/,(?!\s\d)/)
            .map((c) => c.split(';')[0].trim());
    }

    const cookie = cookieParts.filter((c) => c.includes('=')).join('; ');
    if (!cookie) {
        throw new Error('Failed to get Yahoo Finance session cookie');
    }

    // Step 2: Get crumb using the session cookie
    const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
        headers: { Cookie: cookie, 'User-Agent': USER_AGENT },
    });

    if (!crumbRes.ok) {
        throw new Error(`Failed to get Yahoo Finance crumb: ${crumbRes.statusText}`);
    }

    const crumb = await crumbRes.text();
    if (!crumb || crumb.includes('<!DOCTYPE')) {
        throw new Error('Invalid crumb response from Yahoo Finance');
    }

    cachedCookie = cookie;
    cachedCrumb = crumb;
    cacheExpiry = now + CACHE_TTL_MS;

    return { cookie, crumb };
}

/**
 * Fetches a Yahoo Finance API endpoint with proper cookie+crumb authentication.
 * Automatically retries once if the auth credentials have expired (401).
 */
export async function fetchFromYahoo(path: string): Promise<Response> {
    const { cookie, crumb } = await getYahooAuth();
    const separator = path.includes('?') ? '&' : '?';
    const url = `https://query2.finance.yahoo.com${path}${separator}crumb=${encodeURIComponent(crumb)}`;

    const response = await fetch(url, {
        headers: { Cookie: cookie, 'User-Agent': USER_AGENT },
    });

    // If 401, invalidate cache and retry once
    if (response.status === 401) {
        cachedCookie = null;
        cachedCrumb = null;
        cacheExpiry = 0;

        const auth = await getYahooAuth();
        const retryUrl = `https://query2.finance.yahoo.com${path}${separator}crumb=${encodeURIComponent(auth.crumb)}`;
        return fetch(retryUrl, {
            headers: { Cookie: auth.cookie, 'User-Agent': USER_AGENT },
        });
    }

    return response;
}
