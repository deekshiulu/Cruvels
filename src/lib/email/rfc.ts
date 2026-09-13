export function normalizeRfcMessageId(id?: string | null): string {
  if (!id) return '';
  return String(id).trim().replace(/^<|>$/g, '').toLowerCase();
}

export function wrapRfcMessageId(id?: string | null): string | undefined {
  const normalized = normalizeRfcMessageId(id);
  if (!normalized) return undefined;
  return `<${normalized}>`;
}

export function generateRfcMessageId(fromAddress: string): string {
  const domain = (fromAddress.split('@')[1] || 'cruvels.com').replace(/[^\w.-]/g, '') || 'cruvels.com';
  return `${crypto.randomUUID()}@${domain}`;
}

export function textToEmailHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped.replace(/\n/g, '<br>');
}
