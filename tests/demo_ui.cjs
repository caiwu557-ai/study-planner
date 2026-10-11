const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(process.argv[2] || 'http://127.0.0.1:18769/demo/');
    await page.getByRole('button', { name: '重置演示' }).click();
    await page.getByRole('tab', { name: '复习清单' }).click();
    await page.getByRole('checkbox').first().check();
    assert.equal(await page.locator('.row.done').count(), 1);
    await page.reload();
    await page.getByRole('tab', { name: '复习清单' }).click();
    assert.equal(await page.locator('.row.done').count(), 1);
    await page.getByRole('button', { name: '＋ 添加事项' }).click();
    const title = '测试 <img src=x onerror=alert(1)> & 笔记';
    await page.locator('[name=title]').fill(title);
    await page.getByRole('button', { name: '添加', exact: true }).click();
    assert.equal(await page.locator('.row strong').last().textContent(), title);
    assert.equal(await page.locator('#content img').count(), 0);
    await page.locator('.row').last().getByRole('button').click();
    await page.getByRole('button', { name: '撤销', exact: true }).click();
    assert.equal(await page.locator('.row strong').last().textContent(), title);
    await page.locator('.row').last().getByRole('button').click();
    await page.waitForTimeout(6200);
    assert.equal(await page.locator('#toast').isVisible(), false);
    await page.getByRole('tab', { name: '月清单' }).click();
    assert.ok(await page.locator('.date').count() >= 28);
    await page.selectOption('#theme', 'green');
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent')), '#2f7a63');
    await page.setViewportSize({ width: 393, height: 852 });
    for (const name of ['周课表', '月清单', '复习清单', '待办清单', '到期清单']) {
      await page.getByRole('tab', { name }).click();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name + ' overflows phone viewport');
    }
    await page.getByRole('button', { name: '重置演示' }).click();
    assert.deepEqual(errors, []);
    if (process.env.DEMO_SCREENSHOT) await page.screenshot({ path: process.env.DEMO_SCREENSHOT, fullPage: true });
    console.log('Demo checks passed: persistence, safe text, add/delete/undo/expiry, views, theme, phone layout.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
