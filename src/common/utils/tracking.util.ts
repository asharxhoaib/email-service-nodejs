/**
 * HTML rewriting for open + click tracking. Pure functions so they are trivially
 * unit-testable and never touch the database.
 */

/** 1x1 transparent GIF, base64. Served by the open-tracking endpoint. */
export const TRANSPARENT_GIF_BASE64 =
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export function transparentGifBuffer(): Buffer {
  return Buffer.from(TRANSPARENT_GIF_BASE64, 'base64');
}

/** Append a tracking pixel just before </body> (or at the end if none). */
export function injectTrackingPixel(
  html: string,
  trackingId: string,
  baseUrl: string,
): string {
  const pixel = `<img src="${baseUrl}/api/v1/tracking/open/${trackingId}" width="1" height="1" alt="" style="display:none" />`;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${pixel}</body>`);
  }
  return html + pixel;
}

/**
 * Rewrite every <a href="..."> so clicks route through the click-tracking
 * endpoint. Skips anchors, mailto:, tel:, and already-rewritten links.
 */
export function rewriteLinks(
  html: string,
  trackingId: string,
  baseUrl: string,
): string {
  return html.replace(
    /(<a\b[^>]*\bhref=)(["'])(.*?)\2/gi,
    (match, prefix, quote, url) => {
      if (/^(#|mailto:|tel:)/i.test(url)) return match;
      if (url.includes('/tracking/click/')) return match;
      const redirect = `${baseUrl}/api/v1/tracking/click/${trackingId}?url=${encodeURIComponent(url)}`;
      return `${prefix}${quote}${redirect}${quote}`;
    },
  );
}

/** Append a visible unsubscribe footer with the one-click link. */
export function injectUnsubscribeFooter(
  html: string,
  token: string,
  baseUrl: string,
): string {
  const link = `${baseUrl}/api/v1/unsubscribe/${token}`;
  const footer = `<div style="font-size:12px;color:#888;margin-top:24px">If you no longer wish to receive these emails, <a href="${link}">unsubscribe here</a>.</div>`;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${footer}</body>`);
  }
  return html + footer;
}

// Common bot / prefetch user agents that fire open pixels without a human.
const BOT_UA_PATTERNS = [
  /googleimageproxy/i,
  /bingpreview/i,
  /yahoomailproxy/i,
  /facebookexternalhit/i,
  /slackbot/i,
  /bot\b/i,
  /crawler/i,
  /spider/i,
  /preview/i,
];

export function isBotUserAgent(ua?: string): boolean {
  if (!ua) return false;
  return BOT_UA_PATTERNS.some((re) => re.test(ua));
}
