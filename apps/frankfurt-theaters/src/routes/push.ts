import {
  handlePushKeyRequest,
  handlePushMeRequest,
  handlePushSubscribeRequest,
  handlePushUnsubscribeRequest,
} from "@museumsufer/core";
import { Hono } from "hono";
import type { Env } from "../types";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/push/key", (c) => handlePushKeyRequest(c.env));
app.post("/api/push/subscribe", (c) => handlePushSubscribeRequest(c.req.raw, c.env));
app.post("/api/push/unsubscribe", (c) => handlePushUnsubscribeRequest(c.req.raw, c.env));
app.get("/api/push/me", (c) => handlePushMeRequest(c.req.raw, c.env));

export default app;
