from playwright.sync_api import sync_playwright

URL = "https://museumsufer.app/"
SCREENSHOTS = "/home/jonass/Documents/museumsufer/screenshots"

def capture():
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # Desktop 1280x800 - top of page
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.goto(URL, wait_until="networkidle")
        page.screenshot(path=f"{SCREENSHOTS}/desktop_top.png", full_page=False)
        print(f"Saved: {SCREENSHOTS}/desktop_top.png")

        # Mobile 390x844
        page2 = browser.new_page(viewport={"width": 390, "height": 844})
        page2.goto(URL, wait_until="networkidle")
        page2.screenshot(path=f"{SCREENSHOTS}/mobile_top.png", full_page=False)
        print(f"Saved: {SCREENSHOTS}/mobile_top.png")

        # Close-up: use desktop page, clip to AskAI section
        # Take a tall above-the-fold shot then we'll identify coords via a clip approach.
        # First get the bounding box of the askai section via JS.
        page3 = browser.new_page(viewport={"width": 1280, "height": 800})
        page3.goto(URL, wait_until="networkidle")

        # Try to find the AskAI row by looking for an element containing "Frag eine KI"
        askai_box = page3.evaluate("""() => {
            // Try various selectors
            const selectors = [
                '[class*="askai"]', '[class*="ask-ai"]', '[class*="AskAI"]',
                '[id*="askai"]', '[id*="ask-ai"]',
            ];
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el) {
                    const r = el.getBoundingClientRect();
                    return { x: r.x, y: r.y, width: r.width, height: r.height, selector: sel };
                }
            }
            // Fallback: find element containing "Frag eine KI" text
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            let node;
            while (node = walker.nextNode()) {
                if (node.textContent.includes('Frag eine KI')) {
                    const el = node.parentElement?.closest('div, section, nav') || node.parentElement;
                    const r = el.getBoundingClientRect();
                    return { x: r.x, y: r.y, width: r.width, height: r.height, selector: el.tagName + '.' + el.className };
                }
            }
            return null;
        }""")

        print(f"AskAI bounding box: {askai_box}")

        if askai_box and askai_box["width"] > 0 and askai_box["height"] > 0:
            # Add some padding around the element
            pad = 24
            clip = {
                "x": max(0, askai_box["x"] - pad),
                "y": max(0, askai_box["y"] - pad),
                "width": min(1280, askai_box["width"] + pad * 2),
                "height": askai_box["height"] + pad * 2,
            }
            page3.screenshot(path=f"{SCREENSHOTS}/askai_closeup.png", clip=clip)
            print(f"Saved close-up: {SCREENSHOTS}/askai_closeup.png")
        else:
            # Fallback: capture top 400px which should include the section
            page3.screenshot(
                path=f"{SCREENSHOTS}/askai_closeup.png",
                clip={"x": 0, "y": 0, "width": 1280, "height": 400},
            )
            print(f"Saved fallback close-up: {SCREENSHOTS}/askai_closeup.png")

        browser.close()

if __name__ == "__main__":
    capture()
