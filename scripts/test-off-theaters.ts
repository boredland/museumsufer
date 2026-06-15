const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const headers = { "User-Agent": UA };

async function checkUrl(url: string, name: string) {
  try {
    const res = await fetch(url, { headers });
    const text = await res.text();
    console.log(`\n=== ${name} (${url}) ===`);
    console.log(`Status: ${res.status}, Length: ${text.length}`);
    
    // Check if there are listing keywords
    const keywords = ["spielplan", "programm", "ticket", "event", "reservix", "eventim"];
    for (const kw of keywords) {
      const count = (text.match(new RegExp(kw, "gi")) || []).length;
      console.log(`  Keyword "${kw}": ${count} matches`);
    }
    
    // Dump some hrefs
    const hrefs = [...text.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
    console.log("  Hrefs (sample):", Array.from(new Set(hrefs)).slice(0, 10));
  } catch (e) {
    console.error(e);
  }
}

await checkUrl("https://muttheater.de/programm/", "MUT! Theater Programm");
await checkUrl("https://www.theater-das-zimmer.de/", "Theater das Zimmer Main");
await checkUrl("https://www.sprechwerk.hamburg/programm/", "Hamburger Sprechwerk Programm");
await checkUrl("https://tickets.centralkomitee.de/api/events", "Centralkomitee Event API");
await checkUrl("https://tickets.centralkomitee.de/api/v1/events", "Centralkomitee Event API v1");
await checkUrl("https://tickets.centralkomitee.de/api/v2/events", "Centralkomitee Event API v2");
