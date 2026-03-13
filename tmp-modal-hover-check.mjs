import { chromium } from "playwright";

const URL = "http://127.0.0.1:4173/web3-wallet";

function roundRect(rect) {
  return {
    x: Number(rect.x.toFixed(2)),
    y: Number(rect.y.toFixed(2)),
    width: Number(rect.width.toFixed(2)),
    height: Number(rect.height.toFixed(2)),
  };
}

function deltaRect(before, after) {
  return {
    dx: Number((after.x - before.x).toFixed(2)),
    dy: Number((after.y - before.y).toFixed(2)),
    dWidth: Number((after.width - before.width).toFixed(2)),
    dHeight: Number((after.height - before.height).toFixed(2)),
  };
}

async function getModalRect(page) {
  const modals = page.locator('[role="dialog"]');
  const count = await modals.count();
  if (!count) return null;
  for (let i = 0; i < count; i += 1) {
    const modal = modals.nth(i);
    if (!(await modal.isVisible())) continue;
    const box = await modal.boundingBox();
    if (!box) continue;
    if (box.width < 120 || box.height < 120) continue;
    return { modal, rect: roundRect(box) };
  }
  return null;
}

async function openWalletModal(page) {
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  const button = page.getByRole("button", { name: /connect wallet|complete\s*&\s*verify/i }).first();
  await button.waitFor({ state: "visible", timeout: 15000 });
  await button.click();
  await page.waitForTimeout(400);
}

async function runScenario(context, viewportName) {
  const page = await context.newPage();
  await openWalletModal(page);

  const modalDataBefore = await getModalRect(page);
  if (!modalDataBefore) {
    throw new Error(`Could not locate modal for ${viewportName}`);
  }

  const { modal } = modalDataBefore;
  const before = modalDataBefore.rect;

  const box = await modal.boundingBox();
  if (!box) {
    throw new Error(`Modal bounding box unavailable for ${viewportName}`);
  }

  const points = [
    { x: box.x + box.width * 0.2, y: box.y + box.height * 0.2 },
    { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 },
    { x: box.x + box.width * 0.8, y: box.y + box.height * 0.8 },
    { x: box.x + box.width * 0.5, y: box.y + box.height * 0.25 },
  ];

  for (const p of points) {
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(120);
  }

  const rows = modal.locator('button, [role="button"], [data-testid*="wallet"], li, [class*="wallet"]');
  const rowCount = await rows.count();
  const iterations = Math.min(rowCount, 8);
  for (let i = 0; i < iterations; i += 1) {
    const row = rows.nth(i);
    if (!(await row.isVisible())) continue;
    try {
      await row.hover({ timeout: 1000 });
      await page.waitForTimeout(120);
    } catch {
      // ignore non-hoverable nodes
    }
  }

  const modalDataAfter = await getModalRect(page);
  if (!modalDataAfter) {
    throw new Error(`Could not re-locate modal for ${viewportName}`);
  }

  const after = modalDataAfter.rect;
  const delta = deltaRect(before, after);
  const moved = delta.dx !== 0 || delta.dy !== 0;

  await page.close();
  return { viewport: viewportName, before, after, delta, moved };
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  try {
    const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const desktop = await runScenario(desktopContext, "desktop");
    await desktopContext.close();

    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    const mobile = await runScenario(mobileContext, "mobile-390");
    await mobileContext.close();

    process.stdout.write(`${JSON.stringify({ desktop, mobile }, null, 2)}\n`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  process.stderr.write(`${err?.stack || err}\n`);
  process.exit(1);
});
