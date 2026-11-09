export default async function run(page, ui) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#board', { timeout: 15000 });
  await page.waitForTimeout(800);

  const metrics = await page.evaluate(() => {
    const board = document.getElementById('board');
    const burger = document.getElementById('burgerMenu');
    const side = document.getElementById('side');
    const menu = document.getElementById('mobileMenu');
    const br = board.getBoundingClientRect();
    const bg = burger.getBoundingClientRect();
    const sr = side.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const boardOverflowRight = br.right - vw;
    const boardOverflowLeft = -br.left;
    const centerOffset = (br.left + br.right) / 2 - vw / 2;
    return {
      vw,
      vh,
      bodyClass: document.body.className,
      htmlClass: document.documentElement.className,
      board: { left: br.left, right: br.right, width: br.width, height: br.height, top: br.top },
      burger: {
        display: getComputedStyle(burger).display,
        left: bg.left,
        bottomFromViewport: vh - bg.bottom,
        top: bg.top,
        visible: bg.top >= 0 && bg.bottom <= vh && bg.left >= 0 && bg.right <= vw,
      },
      side: { left: sr.left, right: sr.right, width: sr.width, overflowRight: sr.right - vw },
      boardOverflowRight,
      boardOverflowLeft,
      centerOffset,
      menuTransform: getComputedStyle(menu).transform,
      menuVisibility: getComputedStyle(menu).visibility,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });

  await page.screenshot({ path: 'c:/Users/DELL/Vercel-Chess-Game-Test/_mobile-closed.png' });

  await page.click('#burgerMenu');
  await page.waitForTimeout(400);

  const afterOpen = await page.evaluate(() => {
    const menu = document.getElementById('mobileMenu');
    const overlay = document.getElementById('menuOverlay');
    const mr = menu.getBoundingClientRect();
    const heading = menu.querySelector('h3');
    return {
      menuActive: menu.classList.contains('active'),
      overlayDisplay: getComputedStyle(overlay).display,
      menu: { top: mr.top, bottom: mr.bottom, height: mr.height, visible: mr.height > 50 && mr.top < window.innerHeight },
      heading: heading ? heading.textContent : null,
      transform: getComputedStyle(menu).transform,
      visibility: getComputedStyle(menu).visibility,
    };
  });

  await page.screenshot({ path: 'c:/Users/DELL/Vercel-Chess-Game-Test/_mobile-open.png' });

  return { metrics, afterOpen };
}
