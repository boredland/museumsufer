const http = require("node:http");
const https = require("node:https");

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const AUTH_TOKEN = process.env.AUTH_TOKEN || "";
const PORT = process.env.PORT || 3000;

http
  .createServer(async (req, res) => {
    if (AUTH_TOKEN) {
      const auth = req.headers.authorization;
      if (auth !== `Bearer ${AUTH_TOKEN}`) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end('{"error":"unauthorized"}');
        return;
      }
    }

    const url = new URL(req.url, `http://${req.headers.host}`).searchParams.get(
      "url",
    );
    if (!url) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end('{"error":"?url= parameter required"}');
      return;
    }

    console.log(`-> ${url}`);
    try {
      const r = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        },
        redirect: "follow",
      });
      console.log(`<- ${r.status} ${url}`);
      const body = Buffer.from(await r.arrayBuffer());
      res.writeHead(r.status, {
        "content-type": r.headers.get("content-type") || "text/html",
      });
      res.end(body);
    } catch (e) {
      console.error(`!! ${url}: ${e.message}`);
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
  })
  .listen(PORT, () => console.log(`fetch-proxy listening on :${PORT}`));
