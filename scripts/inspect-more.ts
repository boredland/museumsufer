const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const headers = { "User-Agent": UA };

async function inspectHoheLuftschiff() {
  try {
    const res = await fetch("https://hoheluftschiff.de/spielplan", { headers });
    const text = await res.text();
    console.log("=== HoheLuftschiff Content Check ===");
    // Find all strings like "DD.MM.YYYY" or "DD.MM." or occurrences of dates
    const dateRegex = /\d{1,2}\.\s*(?:Jan|Feb|Mär|Apr|Mai|Jun|Jul|Aug|Sep|Okt|Nov|Dez|Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)/gi;
    const dateMatches = [...text.matchAll(dateRegex)];
    console.log(`Found ${dateMatches.length} month-based dates`);
    dateMatches.slice(0, 10).forEach(m => console.log("  Date:", m[0]));

    // Find any block classes
    const classes = [...text.matchAll(/class="([^"]+)"/g)].map(m => m[1]);
    console.log("Unique class names (sample):", Array.from(new Set(classes)).slice(0, 30));
  } catch (e) {
    console.error(e);
  }
}

async function inspectFundusJS() {
  try {
    const res = await fetch("https://www.fundus-theater.de/spielplan/", { headers });
    const text = await res.text();
    // Look for all js bundles
    const jsFiles = [...text.matchAll(/src="([^"]+\.js)"/g)].map(m => m[1]);
    console.log("\n=== Fundus JS Files ===");
    console.log(jsFiles);
    
    for (const file of jsFiles) {
      const fullUrl = file.startsWith("http") ? file : `https://www.fundus-theater.de${file}`;
      const jsRes = await fetch(fullUrl, { headers });
      const jsText = await jsRes.text();
      console.log(`JS File: ${file}, Length: ${jsText.length}`);
      
      // Search for API paths
      const paths = [...jsText.matchAll(/["'](\/(?:api|wp-json|json|fileadmin)[^"']+)["']/g)].map(m => m[1]);
      console.log("Found possible API paths (first 20):", Array.from(new Set(paths)).slice(0, 20));
    }
  } catch (e) {
    console.error(e);
  }
}

await inspectHoheLuftschiff();
await inspectFundusJS();
