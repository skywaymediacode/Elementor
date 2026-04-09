const path = require('path');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeWebsite(url, clientSlug) {
  const clientDir = path.join(process.env.CLIENTS_DIR || path.join(__dirname, '..', 'clients'), clientSlug);
  const assetsDir = path.join(clientDir, 'assets');
  const screenshotsDir = path.join(clientDir, 'screenshots');

  [assetsDir, screenshotsDir].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  let result;

  try {
    // Try Playwright first for full rendering
    result = await scrapeWithPlaywright(url, assetsDir, screenshotsDir);
  } catch (err) {
    console.warn('Playwright scrape failed, falling back to HTTP:', err.message);
    // Fallback to simple HTTP fetch
    result = await scrapeWithHttp(url, assetsDir);
  }

  result.clientSlug = clientSlug;
  return result;
}

async function scrapeWithPlaywright(url, assetsDir, screenshotsDir) {
  let browser;
  try {
    const { chromium } = require('playwright');
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    // Navigate and wait for full load
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // Auto-dismiss cookie banners
    try {
      const cookieSelectors = [
        '[class*="cookie"] button',
        '[id*="cookie"] button',
        '[class*="consent"] button',
        '[class*="gdpr"] button',
        'button:has-text("Accept")',
        'button:has-text("Got it")',
        'button:has-text("OK")',
        'button:has-text("I agree")',
      ];
      for (const sel of cookieSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await btn.click();
          await page.waitForTimeout(500);
          break;
        }
      }
    } catch { /* no cookie banner */ }

    // Wait for lazy-loaded content
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    // Take full-page screenshot
    const screenshotPath = path.join(screenshotsDir, 'full-page.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // Get page title
    const title = await page.title();

    // Extract clean HTML
    const html = await page.content();

    // Extract all stylesheets content
    const styles = await page.evaluate(() => {
      const allStyles = [];
      // Inline styles
      document.querySelectorAll('style').forEach(s => allStyles.push(s.textContent));
      // External stylesheets
      for (const sheet of document.styleSheets) {
        try {
          const rules = Array.from(sheet.cssRules || []);
          allStyles.push(rules.map(r => r.cssText).join('\n'));
        } catch { /* cross-origin */ }
      }
      return allStyles.join('\n');
    });

    // Extract computed styles for key elements
    const computedData = await page.evaluate(() => {
      const data = { colors: new Set(), fonts: new Set() };
      const elements = document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,a,button,span,div,section,header,footer,nav');

      elements.forEach(el => {
        const cs = window.getComputedStyle(el);
        if (cs.color) data.colors.add(cs.color);
        if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') data.colors.add(cs.backgroundColor);
        if (cs.fontFamily) data.fonts.add(cs.fontFamily.split(',')[0].trim().replace(/['"]/g, ''));
      });

      return { colors: [...data.colors], fonts: [...data.fonts] };
    });

    // Extract images
    const imageUrls = await page.evaluate(() => {
      const imgs = [];
      document.querySelectorAll('img').forEach(img => {
        if (img.src && !img.src.startsWith('data:')) imgs.push({ src: img.src, alt: img.alt || '' });
      });
      // Background images
      document.querySelectorAll('*').forEach(el => {
        const bg = window.getComputedStyle(el).backgroundImage;
        if (bg && bg !== 'none') {
          const match = bg.match(/url\(["']?(.+?)["']?\)/);
          if (match && !match[1].startsWith('data:')) imgs.push({ src: match[1], alt: '' });
        }
      });
      return imgs;
    });

    // Download images
    const downloadedImages = [];
    for (let i = 0; i < imageUrls.length; i++) {
      try {
        const imgUrl = new URL(imageUrls[i].src, url).href;
        const ext = path.extname(new URL(imgUrl).pathname) || '.png';
        const filename = `img_${i}${ext}`;
        const imgPath = path.join(assetsDir, filename);

        const response = await axios.get(imgUrl, { responseType: 'arraybuffer', timeout: 10000 });
        fs.writeFileSync(imgPath, Buffer.from(response.data));
        downloadedImages.push({
          originalUrl: imgUrl,
          localPath: imgPath,
          filename,
          alt: imageUrls[i].alt,
        });
      } catch { /* skip failed image downloads */ }
    }

    // Map page into sections
    const sections = await page.evaluate(() => {
      const sectionData = [];

      function getElData(el, role) {
        const cs = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          role,
          tag: el.tagName.toLowerCase(),
          html: el.outerHTML.substring(0, 5000), // limit size
          text: el.innerText?.substring(0, 2000) || '',
          styles: {
            backgroundColor: cs.backgroundColor,
            color: cs.color,
            padding: cs.padding,
            margin: cs.margin,
            fontFamily: cs.fontFamily,
            fontSize: cs.fontSize,
            textAlign: cs.textAlign,
            display: cs.display,
            flexDirection: cs.flexDirection,
            justifyContent: cs.justifyContent,
            alignItems: cs.alignItems,
            backgroundImage: cs.backgroundImage,
            borderRadius: cs.borderRadius,
          },
          dimensions: { width: rect.width, height: rect.height, top: rect.top },
          childCount: el.children.length,
        };
      }

      // Header/Nav
      const header = document.querySelector('header, nav, [role="banner"], [class*="header"], [class*="navbar"]');
      if (header) sectionData.push(getElData(header, 'header'));

      // Hero (first large section after header)
      const hero = document.querySelector('[class*="hero"], [class*="banner"], [class*="jumbotron"], main > section:first-child, main > div:first-child');
      if (hero) sectionData.push(getElData(hero, 'hero'));

      // Content sections
      const contentSections = document.querySelectorAll('main section, main > div, [class*="section"], article');
      contentSections.forEach((sec, i) => {
        if (sec !== hero && sec !== header && sec.innerText?.trim()) {
          const rect = sec.getBoundingClientRect();
          if (rect.height > 50) {
            sectionData.push(getElData(sec, `section_${i}`));
          }
        }
      });

      // Footer
      const footer = document.querySelector('footer, [role="contentinfo"], [class*="footer"]');
      if (footer) sectionData.push(getElData(footer, 'footer'));

      return sectionData;
    });

    // Convert colors from rgb to hex
    const hexColors = computedData.colors.map(c => rgbToHex(c)).filter(Boolean);
    const uniqueColors = [...new Set(hexColors)].slice(0, 20);

    await browser.close();

    return {
      url,
      title,
      slug: title ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : 'imported-page',
      html,
      css: styles,
      sections,
      colors: uniqueColors,
      fonts: computedData.fonts.filter(f => f && f !== 'inherit').slice(0, 10),
      images: downloadedImages,
      screenshotPath: screenshotPath,
      scrapedAt: new Date().toISOString(),
    };
  } catch (err) {
    if (browser) await browser.close();
    throw err;
  }
}

async function scrapeWithHttp(url, assetsDir) {
  const response = await axios.get(url, {
    timeout: 15000,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' },
  });

  const $ = cheerio.load(response.data);

  // Remove scripts
  $('script').remove();

  const title = $('title').text().trim();

  // Extract styles
  const styles = [];
  $('style').each((_, el) => styles.push($(el).html()));

  // Extract images
  const images = [];
  $('img').each((i, el) => {
    const src = $(el).attr('src');
    if (src && !src.startsWith('data:')) {
      images.push({ originalUrl: new URL(src, url).href, alt: $(el).attr('alt') || '', filename: `img_${i}.png` });
    }
  });

  // Download images
  const downloadedImages = [];
  for (const img of images.slice(0, 50)) {
    try {
      const ext = path.extname(new URL(img.originalUrl).pathname) || '.png';
      const filename = `img_${downloadedImages.length}${ext}`;
      const imgPath = path.join(assetsDir, filename);
      const imgResp = await axios.get(img.originalUrl, { responseType: 'arraybuffer', timeout: 10000 });
      fs.writeFileSync(imgPath, Buffer.from(imgResp.data));
      downloadedImages.push({ ...img, localPath: imgPath, filename });
    } catch { /* skip */ }
  }

  // Build sections
  const sections = [];
  const header = $('header, nav').first();
  if (header.length) sections.push({ role: 'header', tag: 'header', html: header.html()?.substring(0, 5000), text: header.text()?.substring(0, 2000) });

  $('section, main > div, [class*="section"]').each((i, el) => {
    const text = $(el).text()?.trim();
    if (text) sections.push({ role: `section_${i}`, tag: el.tagName.toLowerCase(), html: $(el).html()?.substring(0, 5000), text: text.substring(0, 2000) });
  });

  const footer = $('footer').first();
  if (footer.length) sections.push({ role: 'footer', tag: 'footer', html: footer.html()?.substring(0, 5000), text: footer.text()?.substring(0, 2000) });

  // Extract colors from inline styles
  const colors = [];
  const colorRegex = /#[0-9a-fA-F]{3,8}/g;
  const allStyles = styles.join(' ') + ' ' + $.html();
  const colorMatches = allStyles.match(colorRegex) || [];
  const uniqueColors = [...new Set(colorMatches)].slice(0, 20);

  return {
    url,
    title,
    slug: title ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : 'imported-page',
    html: $.html(),
    css: styles.join('\n'),
    sections,
    colors: uniqueColors,
    fonts: [],
    images: downloadedImages,
    screenshotPath: null,
    scrapedAt: new Date().toISOString(),
  };
}

function rgbToHex(color) {
  if (!color) return null;
  if (color.startsWith('#')) return color;
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;
  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

module.exports = { scrapeWebsite };
