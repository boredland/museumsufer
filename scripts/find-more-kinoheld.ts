const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const headers = { "User-Agent": UA };

async function findId(url: string, name: string) {
  try {
    const res = await fetch(url, { headers });
    const html = await res.text();
    const matches = [
      ...html.matchAll(/cinemaId["']?\s*:\s*["']?(\d+)["']?/gi),
      ...html.matchAll(/cinema[-_]id["']?\s*:\s*["']?(\d+)["']?/gi),
      ...html.matchAll(/data-cinema-id=["'](\d+)["']/gi),
      ...html.matchAll(/cinema\/(\d+)/gi),
      ...html.matchAll(/"cinema"\s*:\s*{\s*"id"\s*:\s*["']?(\d+)["']?/gi),
      ...html.matchAll(/"cinemaId"\s*:\s*(\d+)/gi),
    ];
    const ids = Array.from(new Set(matches.map(m => m[1])));
    console.log(`${name}:`, ids);
  } catch (err) {
    console.error(`Failed for ${name}:`, err);
  }
}

await findId("https://www.kinoheld.de/kino-hamburg/abaton-kino-hamburg", "Abaton");
await findId("https://www.kinoheld.de/kino-hamburg/passage-kino-hamburg", "Passage Kino");
