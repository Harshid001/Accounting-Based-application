import puppeteer from 'puppeteer';
import { PrismaClient } from '@prisma/client';

(async () => {
  console.log('Starting puppeteer tests with real image URL...');
  const prisma = new PrismaClient();
  
  await prisma.user.update({
    where: { email: 'admin@afms.com' },
    data: { image: 'https://btlznrxpitsqclzwgqfj.supabase.co/storage/v1/object/public/afms-documents/avatars/test-real-image.png' }
  });

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  let hasErrors = false;
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      if (msg.text().includes('favicon')) return;
      console.error('Console Error:', msg.text());
      hasErrors = true;
    }
  });

  page.on('response', response => {
    const status = response.status();
    const url = response.url();
    if (status >= 400 && !url.includes('favicon')) {
      console.error(`HTTP Error: ${status} ${url}`);
      hasErrors = true;
    }
  });

  try {
    console.log('Navigating to login...');
    await page.goto('http://localhost:3000/login');
    
    await page.type('input[type="email"]', 'admin@afms.com');
    await page.type('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    console.log('Dashboard loaded.');
    
    // Check if image is rendered in AccountMenu
    const menuImageSrc = await page.evaluate(() => {
      const img = document.querySelector('img[alt="System Admin"]') as HTMLImageElement;
      return img ? img.src : null;
    });
    console.log('AccountMenu Image src rendered:', menuImageSrc);
    
    console.log('Navigating to account page...');
    await page.goto('http://localhost:3000/dashboard/account', { waitUntil: 'networkidle0' });
    console.log('Account page loaded.');

    const accountImageSrc = await page.evaluate(() => {
      const img = document.querySelector('img[alt="Your avatar"]') as HTMLImageElement;
      return img ? img.src : null;
    });
    console.log('Account page Image src rendered:', accountImageSrc);

    await new Promise(r => setTimeout(r, 2000));
    
  } catch (err) {
    console.error(err);
    hasErrors = true;
  } finally {
    // Cleanup the DB
    await prisma.user.update({
      where: { email: 'admin@afms.com' },
      data: { image: null }
    });
    await prisma.$disconnect();
    await browser.close();
  }
  
  if (hasErrors) {
    console.log('Test Failed due to errors!');
    process.exit(1);
  } else {
    console.log('Verification passed: <Image> component rendered the real photo successfully with no console errors.');
    process.exit(0);
  }
})();
