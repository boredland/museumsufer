import { EmailMessage } from "cloudflare:email";
import { buildFeedbackMime } from "./feedback-email";
import { verifyTurnstileToken } from "./turnstile";

/**
 * Shared Env slice that every feedback-enabled worker exposes.
 * Apps extend this in their own Env interface.
 */
export interface FeedbackEnv {
  FEEDBACK_EMAIL: SendEmail;
  TURNSTILE_SECRET?: string;
  TURNSTILE_SITE_KEY?: string;
}

export interface ContactHandlerOptions {
  /** The incoming Request (Hono callers can pass `c.req.raw`). */
  request: Request;
  /** Worker env. Must contain a SendEmail binding named FEEDBACK_EMAIL plus optional Turnstile config. */
  env: FeedbackEnv;
  /** Identifies the app in the email subject + body (e.g. "konzert-haus"). */
  app: string;
  /** RFC 5322 From address. The domain should be a Cloudflare-managed zone. */
  from: string;
  /** Verified destination address. */
  to: string;
  /** Optional override for the visitor IP (defaults to `cf-connecting-ip` from the request). */
  remoteIp?: string | null;
}

interface ContactBody {
  category?: string;
  email?: string;
  message?: string;
  context?: string;
  "cf-turnstile-response"?: string;
}

/**
 * Handles a /api/contact POST end-to-end: validates the JSON body, optionally
 * verifies the Turnstile token (skipped if `TURNSTILE_SECRET` isn't set), and
 * sends the message as an email via the `FEEDBACK_EMAIL` Send Email binding.
 *
 * Returns a native Response that Hono (or any other framework) can return directly.
 */
export async function handleContactRequest(opts: ContactHandlerOptions): Promise<Response> {
  const { request, env, app, from, to } = opts;
  const body = await request
    .clone()
    .json<ContactBody>()
    .catch(() => null);

  if (!body?.message || body.message.length < 3) {
    return Response.json({ error: "message required" }, { status: 400 });
  }
  if (body.message.length > 4000) {
    return Response.json({ error: "message too long" }, { status: 400 });
  }

  if (env.TURNSTILE_SECRET) {
    const remoteIp = opts.remoteIp ?? request.headers.get("cf-connecting-ip");
    const verdict = await verifyTurnstileToken(body["cf-turnstile-response"], env.TURNSTILE_SECRET, remoteIp);
    if (!verdict.success) {
      return Response.json({ error: "turnstile failed", codes: verdict.errorCodes }, { status: 400 });
    }
  }

  const raw = buildFeedbackMime({
    from,
    to,
    input: {
      app,
      category: body.category ?? null,
      email: body.email ?? null,
      message: body.message,
      context: body.context ?? null,
      userAgent: request.headers.get("user-agent") ?? null,
      pageUrl: request.headers.get("referer") ?? null,
    },
  });
  await env.FEEDBACK_EMAIL.send(new EmailMessage(from, to, raw));

  return Response.json({ ok: true });
}
