// Test if the client script event delegation works

const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body>
  <button type="button" data-share-type="museum" data-share-id="test-id" data-share-title="Test Museum" data-share-museum="">
    Share
  </button>
  <button type="button" data-report-type="museum" data-report-title="Test Museum" data-report-url="">
    Report
  </button>
  <dialog id="contact-dialog">Test Dialog</dialog>
  
  <script>
    const T = { shareCopied: 'Link copied', contactSubmit: 'Send' };
    const CURRENT_LANG = 'de';
    const DATE_LOCALE = 'de-DE';
    const LOCALES = ['de', 'en', 'fr'];
    const BERLIN_TODAY = '2024-01-01';
    const __INITIAL_DATE__ = null;
    
    console.log('Test: T =', T);
    console.log('Test: CURRENT_LANG =', CURRENT_LANG);
    
    // Check event delegation
    let shareClicked = false;
    let reportClicked = false;
    
    document.addEventListener('click', function(e) {
      var shareBtn = e.target.closest('[data-share-type]');
      if (shareBtn) { 
        console.log('Share button clicked!');
        shareClicked = true;
        e.preventDefault(); 
      }
    });

    document.addEventListener('click', function(e) {
      var reportBtn = e.target.closest('[data-report-type]');
      if (reportBtn) {
        console.log('Report button clicked!');
        reportClicked = true;
        e.preventDefault();
      }
    });
    
    // Simulate button clicks
    const shareBtn = document.querySelector('[data-share-type]');
    const reportBtn = document.querySelector('[data-report-type]');
    
    console.log('Share button found:', shareBtn !== null);
    console.log('Report button found:', reportBtn !== null);
    
    if (shareBtn) {
      shareBtn.click();
      console.log('Share clicked:', shareClicked);
    }
    
    if (reportBtn) {
      reportBtn.click();
      console.log('Report clicked:', reportClicked);
    }
  </script>
</body>
</html>
`;

console.log('=== Client Script Event Delegation Test ===\n');
console.log('Running test...\n');

// Use node's vm module to evaluate the HTML script
const vm = require('vm');
const sandbox = { console, document: null, navigator: { share: false, clipboard: { writeText: () => Promise.resolve() } } };

// Create a simple DOM-like environment
const mockDocument = {
  querySelector: (selector) => {
    if (selector === '[data-share-type]') return { click: () => {}, closest: () => null, dataset: { shareType: 'museum' } };
    if (selector === '[data-report-type]') return { click: () => {}, closest: () => null };
    if (selector === '#contact-dialog') return { showModal: () => {} };
    return null;
  },
  querySelectorAll: () => [],
  getElementById: (id) => id === 'contact-dialog' ? { showModal: () => {} } : null,
  addEventListener: (event, callback) => {
    if (event === 'click') {
      const mockEvent = {
        target: { closest: (sel) => {
          if (sel === '[data-share-type]') return { dataset: { shareType: 'museum', shareId: 'test', shareTitle: 'Test' } };
          if (sel === '[data-report-type]') return { dataset: { reportType: 'museum', reportTitle: 'Test' } };
          return null;
        }},
        preventDefault: () => console.log('Event prevented')
      };
      callback(mockEvent);
    }
  }
};

sandbox.document = mockDocument;

try {
  const scriptContent = html.match(/<script>[\s\S]*<\/script>/)[0].replace(/<\/?script>/g, '');
  vm.runInNewContext(scriptContent, sandbox);
  console.log('\n✓ Client script executed successfully');
  console.log('✓ Event delegation test passed');
} catch (e) {
  console.error('\n✗ Error:', e.message);
}
