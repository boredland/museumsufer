// Test FES Hessen - fetch and examine HTML
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";
const HEADERS = { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" };

async function testFes() {
  try {
    const res = await fetch("https://www.fes.de/landesbuero-hessen/veranstaltungen", { headers: HEADERS });
    console.log("fes-hessen status:", res.status);
    const html = await res.text();
    console.log("fes-hessen html length:", html.length);
    // Try the ITEM_RE
    const ITEM_RE = /<div class="row row--no-margin digbib-event-item[^"]*"[^>]*>([\s\S]+?)<hr\s*\/?>/g;
    const matches = [...html.matchAll(ITEM_RE)];
    console.log("fes-hessen ITEM_RE matches:", matches.length);
    if (matches.length > 0) {
      const card = matches[0][1];
      console.log("First card (first 500 chars):", card.slice(0, 500));
      const SUBHEADER_RE = /<div class="subheader">\s*([\s\S]*?)\s*<\/div>/;
      const sub = card.match(SUBHEADER_RE)?.[1];
      console.log("Subheader:", sub);
    } else {
      // Try to find what the HTML structure looks like
      const idx = html.indexOf('digbib-event');
      if (idx >= 0) console.log("digbib-event context:", html.slice(idx - 50, idx + 300));
      else console.log("No digbib-event found. First 1000 chars:", html.slice(0, 1000));
    }
  } catch(e) { console.error("fes FAILED:", e); }
}

async function testNaxos() {
  try {
    const res = await fetch("https://produktionshausnaxos.de/gruppen/naxos-hallenkonzerte/", { headers: HEADERS });
    console.log("naxos status:", res.status);
    const html = await res.text();
    console.log("naxos html length:", html.length);
    const FUTURE_EVENT_RE = /<a[^>]+href="((?:https?:\/\/produktionshausnaxos\.de)?\/[^"]*\/event\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    const matches = [...html.matchAll(FUTURE_EVENT_RE)];
    console.log("naxos FUTURE_EVENT_RE matches:", matches.length);
    if (matches.length > 0) {
      console.log("First match URL:", matches[0][1]);
    } else {
      const idx = html.indexOf('/event/');
      if (idx >= 0) console.log("/event/ context:", html.slice(idx - 100, idx + 200));
      else { 
        const idx2 = html.indexOf('naxos-hallenkonzerte');
        if (idx2 >= 0) console.log("naxos-hallenkonzerte context:", html.slice(idx2 - 50, idx2 + 300));
        else console.log("No /event/ found. First 2000 chars:", html.slice(0, 2000));
      }
    }
  } catch(e) { console.error("naxos FAILED:", e); }
}

await testFes();
console.log("\n---\n");
await testNaxos();
