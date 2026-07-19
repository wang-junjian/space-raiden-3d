// 快速截取 Boss 战画面（验证视觉效果）
import { chromium } from 'playwright';

const which = process.argv[2] || 'cruiser';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.log('[PAGEERROR]', e.message));

await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
await page.keyboard.press('Enter');
await page.waitForTimeout(1000);

await page.evaluate((which) => {
  const g = window.__game;
  g.player.invincible = 9999;
  g.waves.waveIdx = 99;
  g.waves.pending.length = 0;
  g.enemies.clear();
  g.waves.level.boss = which; // 直接指定 Boss 类型
}, which);

await page.waitForTimeout(8000); // 警告 3.4s + 入场
await page.screenshot({ path: `/tmp/raiden_boss_${which}.png` });
const info = await page.evaluate(() => {
  const g = window.__game;
  return { boss: g.bosses.current?.name, hp: g.bosses.current?.hp, z: g.bosses.current?.pos.z.toFixed(1) };
});
console.log(JSON.stringify(info));
await page.waitForTimeout(4000);
await page.screenshot({ path: `/tmp/raiden_boss_${which}_fight.png` });
await browser.close();
console.log('done');
