/** Development aliases must use the configured cookie/OAuth origin to sign in. */
export function localAuthRedirect(requestUrl: string, configuredUrl?: string): string | null {
  if (!configuredUrl) return null;
  try {
    const request = new URL(requestUrl);
    const configured = new URL(configuredUrl);
    const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
    if (!["/sign-in", "/sign-up"].includes(request.pathname) ||
        !loopback.has(request.hostname) || !loopback.has(configured.hostname) ||
        request.protocol !== configured.protocol || request.port !== configured.port ||
        request.origin === configured.origin) return null;
    request.hostname = configured.hostname;
    return request.toString();
  } catch {
    return null;
  }
}
