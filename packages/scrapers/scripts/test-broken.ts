import { scrapeCafeMutz } from "../src/venues/cafe-mutz";
import { scrapeDeutschesSchauspielhaus } from "../src/venues/deutsches-schauspielhaus";
import { scrapeDigFrankfurt } from "../src/venues/dig-frankfurt";

async function main() {
  console.log("=== cafe-mutz ===");
  try {
    const r = await scrapeCafeMutz();
    console.log(`Events: ${r.events.length}`);
    if (r.events.length > 0) console.log("First event:", JSON.stringify(r.events[0], null, 2));
  } catch (e) {
    console.error("Error:", e);
  }

  console.log("\n=== deutsches-schauspielhaus ===");
  try {
    const r = await scrapeDeutschesSchauspielhaus();
    console.log(`Events: ${r.events.length}`);
    if (r.events.length > 0) console.log("First event:", JSON.stringify(r.events[0], null, 2));
  } catch (e) {
    console.error("Error:", e);
  }

  console.log("\n=== dig-frankfurt ===");
  try {
    const r = await scrapeDigFrankfurt();
    console.log(`Events: ${r.events.length}`);
    if (r.events.length > 0) console.log("First event:", JSON.stringify(r.events[0], null, 2));
  } catch (e) {
    console.error("Error:", e);
  }
}

main();
