import puppeteer from 'puppeteer';

(async () => {
  console.log('Starting puppeteer...');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  let hasErrors = false;
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('Console Error:', msg.text());
      hasErrors = true;
    }
  });

  page.on('response', response => {
    const status = response.status();
    if (status >= 400) {
      console.error(`HTTP Error: ${status} ${response.url()}`);
      hasErrors = true;
    }
  });

  try {
    const testImageUrl = 'http://localhost:3000/_next/image?url=https%3A%2F%2Fbtlznrxpitsqclzwgqfj.supabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fafms-documents%2Favatars%2Ftest.jpg&w=256&q=75';
    console.log('Fetching optimized image:', testImageUrl);
    const response = await page.goto(testImageUrl);
    console.log('Status:', response?.status());
    
    if ((response?.status() ?? 0) >= 400) {
      console.error('Next/Image optimization returned', response?.status());
      hasErrors = true;
    } else {
      console.log('Next/Image optimization returned', response?.status(), '(Success)');
    }
    
  } catch (err) {
    console.error(err);
    hasErrors = true;
  }

  await browser.close();
  
  if (hasErrors) {
    process.exit(1);
  } else {
    console.log('Verification passed: No 400 errors or console errors detected for optimized images.');
    process.exit(0);
  }
})();
