import {
  injectTrackingPixel,
  rewriteLinks,
  isBotUserAgent,
  transparentGifBuffer,
} from '../src/common/utils/tracking.util';

const BASE = 'https://api.example.com';
const TID = 'track-123';

describe('tracking util', () => {
  it('injects the pixel before </body>', () => {
    const out = injectTrackingPixel('<body><p>hi</p></body>', TID, BASE);
    expect(out).toContain(`${BASE}/api/v1/tracking/open/${TID}`);
    expect(out.indexOf('tracking/open')).toBeLessThan(out.indexOf('</body>'));
  });

  it('appends the pixel when there is no body tag', () => {
    const out = injectTrackingPixel('<p>hi</p>', TID, BASE);
    expect(out).toContain(`tracking/open/${TID}`);
  });

  it('rewrites http links through the click tracker with encoded url', () => {
    const out = rewriteLinks('<a href="https://foo.com/x?y=1">go</a>', TID, BASE);
    expect(out).toContain(`tracking/click/${TID}`);
    expect(out).toContain(encodeURIComponent('https://foo.com/x?y=1'));
  });

  it('leaves anchors, mailto and tel links alone', () => {
    const html = '<a href="#top">t</a><a href="mailto:a@b.com">m</a><a href="tel:123">c</a>';
    expect(rewriteLinks(html, TID, BASE)).toBe(html);
  });

  it('detects common bot user agents', () => {
    expect(isBotUserAgent('GoogleImageProxy/1.0')).toBe(true);
    expect(isBotUserAgent('Mozilla/5.0 (iPhone)')).toBe(false);
    expect(isBotUserAgent(undefined)).toBe(false);
  });

  it('returns a valid gif buffer', () => {
    const buf = transparentGifBuffer();
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.slice(0, 3).toString()).toBe('GIF');
  });
});
