import sanitizeHtml from 'sanitize-html';

export interface SanitizeOptions {
  allowImages?: boolean;
}

const DEFAULT_ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'p', 'a', 'ul', 'ol',
  'nl', 'li', 'b', 'i', 'strong', 'em',
  'strike', 'code', 'hr', 'br', 'div',
  'table', 'thead', 'caption', 'tbody',
  'tr', 'th', 'td', 'pre', 'span', 'img'
];

const DEFAULT_ALLOWED_ATTRIBUTES = {
  a: ['href', 'name', 'target', 'rel'],
  img: ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading'],
  '*': ['style', 'class', 'align', 'valign', 'dir']
};

const ALLOWED_CSS_STYLES: { [tag: string]: { [prop: string]: RegExp[] } } = {
  '*': {
    // Whitelist safe typography & box properties only
    'color': [/^#(0x)?[0-9a-f]+$/i, /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i, /^[a-z]+$/i],
    'background-color': [/^#(0x)?[0-9a-f]+$/i, /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i, /^[a-z]+$/i],
    'text-align': [/^(left|right|center|justify)$/i],
    'font-size': [/^\d+(?:px|em|rem|%)$/i],
    'font-weight': [/^(normal|bold|bolder|lighter|\d{3})$/i],
    'font-family': [/^[a-zA-Z0-9,\s\-']+$/i],
    'line-height': [/^\d+(?:\.\d+)?(?:px|em|rem|%)?$/i],
    'margin': [/^[0-9\s.pxemrem%]+$/i],
    'margin-top': [/^[0-9.pxemrem%]+$/i],
    'margin-bottom': [/^[0-9.pxemrem%]+$/i],
    'margin-left': [/^[0-9.pxemrem%]+$/i],
    'margin-right': [/^[0-9.pxemrem%]+$/i],
    'padding': [/^[0-9\s.pxemrem%]+$/i],
    'padding-top': [/^[0-9.pxemrem%]+$/i],
    'padding-bottom': [/^[0-9.pxemrem%]+$/i],
    'padding-left': [/^[0-9.pxemrem%]+$/i],
    'padding-right': [/^[0-9.pxemrem%]+$/i],
    'border': [/^[0-9a-zA-Z\s.#px]+$/i],
    'border-radius': [/^[0-9.pxemrem%]+$/i],
    'width': [/^[0-9.pxemrem%]+$/i],
    'max-width': [/^[0-9.pxemrem%]+$/i],
    'height': [/^[0-9.pxemrem%]+$/i],
    'text-decoration': [/^(none|underline|line-through)$/i],
  }
};

export function sanitizeEmailHtml(rawHtml: string | null | undefined, options: SanitizeOptions = {}): string {
  if (!rawHtml) return '';

  const clean = sanitizeHtml(rawHtml, {
    allowedTags: options.allowImages === false
      ? DEFAULT_ALLOWED_TAGS.filter(t => t !== 'img')
      : DEFAULT_ALLOWED_TAGS,
    allowedAttributes: DEFAULT_ALLOWED_ATTRIBUTES,
    allowedStyles: ALLOWED_CSS_STYLES,
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: {
      img: ['http', 'https', 'data', 'cid'],
      a: ['http', 'https', 'mailto', 'tel'],
    },
    transformTags: {
      a: (tagName: string, attribs: sanitizeHtml.Attributes) => {
        const href = attribs.href || '';
        // Neutralize dangerous schemes or data html
        if (
          href.trim().toLowerCase().startsWith('javascript:') ||
          href.trim().toLowerCase().startsWith('data:') ||
          href.trim().toLowerCase().startsWith('vbscript:')
        ) {
          const safeAttribs: Record<string, string> = { class: 'text-cruvels-muted cursor-not-allowed' };
          return {
            tagName: 'span',
            attribs: safeAttribs,
          };
        }
        const safeAttribs: Record<string, string> = {
          ...attribs,
          target: '_blank',
          rel: 'noopener noreferrer nofollow',
        };
        return {
          tagName: 'a',
          attribs: safeAttribs,
        };
      },
      img: (tagName: string, attribs: sanitizeHtml.Attributes) => {
        const src = attribs.src || '';
        // If data uri, verify it's only safe image data
        if (src.startsWith('data:') && !src.startsWith('data:image/')) {
          const safeAttribs: Record<string, string> = { class: 'hidden' };
          return {
            tagName: 'span',
            attribs: safeAttribs,
          };
        }
        const safeAttribs: Record<string, string> = {
          ...attribs,
          loading: 'lazy',
        };
        return {
          tagName: 'img',
          attribs: safeAttribs,
        };
      },
    },
    disallowedTagsMode: 'discard',
  });

  return purifyHtml(clean);
}

export function purifyHtml(html: string): string {
  if (!html) return '';
  const config = {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel', 'loading', 'class'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
  };
  try {
    const DOMPurify = require('dompurify');
    if (typeof window !== 'undefined' && window.document) {
      return DOMPurify.sanitize(html, config);
    }
    const { JSDOM } = require('jsdom');
    const purify = DOMPurify(new JSDOM('').window);
    return purify.sanitize(html, config);
  } catch {
    return html;
  }
}

export function extractSnippet(textOrHtml: string | null | undefined, maxLength = 140): string {
  if (!textOrHtml) return '';
  // Strip all HTML tags and style/script blocks
  const plain = textOrHtml
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (plain.length <= maxLength) return plain;
  return plain.slice(0, maxLength).trim() + '...';
}
