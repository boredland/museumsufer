export interface FeedbackInput {
  app: string;
  category?: string | null;
  email?: string | null;
  message: string;
  context?: string | null;
  userAgent?: string | null;
  pageUrl?: string | null;
}

export interface BuildFeedbackMimeOptions {
  from: string;
  to: string;
  input: FeedbackInput;
}

export function buildFeedbackMime(opts: BuildFeedbackMimeOptions): string {
  const { from, to, input } = opts;
  const subject = `[${input.app}] ${input.category ?? "Feedback"} – ${truncateLine(input.message, 60)}`;
  const messageId = `<${crypto.randomUUID()}@${addressDomain(from)}>`;
  const date = new Date().toUTCString();
  const replyTo = input.email?.trim() ? `Reply-To: ${headerSafe(input.email)}` : null;

  const bodyLines = [
    `App: ${input.app}`,
    `Category: ${input.category ?? "—"}`,
    `From: ${input.email ?? "(anonymous)"}`,
    `User-Agent: ${input.userAgent ?? "—"}`,
    `Page: ${input.pageUrl ?? "—"}`,
    `Context: ${input.context ?? "—"}`,
    "",
    "─".repeat(40),
    "",
    input.message,
  ];
  const body = bodyLines.join("\r\n");

  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Message-ID: ${messageId}`,
    `Date: ${date}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset="utf-8"`,
    `Content-Transfer-Encoding: 8bit`,
    `Subject: ${encodeHeader(subject)}`,
  ];
  if (replyTo) headers.push(replyTo);

  return `${headers.join("\r\n")}\r\n\r\n${body}`;
}

function truncateLine(s: string, max: number): string {
  const first = s.split(/\r?\n/, 1)[0] ?? s;
  return first.length > max ? `${first.slice(0, max - 1)}…` : first;
}

function addressDomain(addr: string): string {
  const at = addr.lastIndexOf("@");
  return at === -1 ? "localhost" : addr.slice(at + 1).replace(/[>\s]+$/, "");
}

function headerSafe(v: string): string {
  return v.replace(/[\r\n]+/g, " ").trim();
}

function encodeHeader(v: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: header sanitization needs to strip C0 controls
  const safe = v.replace(/[\r\n]/g, " ");
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ASCII range check
  if (/^[\x20-\x7E]*$/.test(safe)) return safe;
  return `=?UTF-8?B?${btoa(unescape(encodeURIComponent(safe)))}?=`;
}
