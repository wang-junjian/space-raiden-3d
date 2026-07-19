// 冒烟测试：真实浏览器加载游戏，捕获控制台错误，模拟游玩
import { chromium } from 'playwright';

const URL = 'http://localhost:5199/';
const errors = [];
const warnings = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
  if (msg.type() === 'warning') warnings.push(msg.text());
});
page.on('pageerror', (err) => errors.push('PAGEERROR: ' + err.message));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const state1 = await page.evaluate(() => window.__game?.state);
console.log('初始状态:', state1);

// 开始游戏
await page.keyboard.press('Enter');
await page.waitForTimeout(2500);
const state2 = await page.evaluate(() => window.__game?.state);
console.log('按 Enter 后状态:', state2);

// 模拟移动 + 战斗 8 秒（保持免伤，专注验证系统）
await page.evaluate(() => { window.__game.player.invincible = 999; });
await page.keyboard.down('KeyD');
await page.waitForTimeout(700);
await page.keyboard.up('KeyD');
await page.keyboard.down('KeyW');
await page.waitForTimeout(500);
await page.keyboard.up('KeyW');
await page.waitForTimeout(3000);

const snap1 = await page.evaluate(() => {
  const g = window.__game;
  return {
    state: g.state, score: g.score,
    enemies: g.enemies.count,
    playerBullets: g.playerBullets.count,
    enemyBullets: g.enemyBullets.count,
    playerAlive: g.player.alive,
    playerPos: { x: +g.player.group.position.x.toFixed(1), z: +g.player.group.position.z.toFixed(1) },
  };
});
console.log('战斗快照:', JSON.stringify(snap1));

// 炸弹
await page.keyboard.press('KeyB');
await page.waitForTimeout(800);
const snap2 = await page.evaluate(() => {
  const g = window.__game;
  return { bombs: g.player.bombs, enemyBullets: g.enemyBullets.count, score: g.score };
});
console.log('炸弹后:', JSON.stringify(snap2));

// 暂停/恢复
await page.keyboard.press('KeyP');
await page.waitForTimeout(300);
const paused = await page.evaluate(() => window.__game.state);
await page.keyboard.press('KeyP');
await page.waitForTimeout(300);
const resumed = await page.evaluate(() => window.__game.state);
console.log('暂停:', paused, '→ 恢复:', resumed);

// 截图（标题/战斗画面）
await page.screenshot({ path: '/tmp/raiden_gameplay.png' });

// 快进到 Boss：标记波次全部完成并清空待刷队列
await page.evaluate(() => {
  const g = window.__game;
  g.player.invincible = 999; // 测试期间免伤
  g.waves.waveIdx = g.waves.level.waves.length;
  g.waves.pending.length = 0;
  g.enemies.clear();
});
await page.waitForTimeout(4500); // 等警告 + Boss 入场
const snap3 = await page.evaluate(() => {
  const g = window.__game;
  return {
    bossActive: g.bosses.active,
    bossName: g.bosses.current?.name,
    bossHp: g.bosses.current?.hp,
    bossZ: g.bosses.current ? +g.bosses.current.pos.z.toFixed(1) : null,
  };
});
console.log('Boss 快照:', JSON.stringify(snap3));
await page.waitForTimeout(5000);
await page.screenshot({ path: '/tmp/raiden_boss.png' });

// 秒杀 Boss → 过关界面
await page.evaluate(() => { const g = window.__game; if (g.bosses.current) g.bosses.current.takeDamage(99999, null); });
await page.waitForTimeout(3500);
const state3 = await page.evaluate(() => window.__game.state);
console.log('Boss 击坠后状态:', state3);
await page.screenshot({ path: '/tmp/raiden_clear.png' });

// 进入第二关
await page.keyboard.press('Enter');
await page.waitForTimeout(2000);
const snap4 = await page.evaluate(() => {
  const g = window.__game;
  return { state: g.state, level: g.levelIndex, score: g.score };
});
console.log('第二关:', JSON.stringify(snap4));
await page.screenshot({ path: '/tmp/raiden_level2.png' });

console.log('\n=== 控制台错误 (' + errors.length + ') ===');
errors.slice(0, 10).forEach(e => console.log(' -', e.slice(0, 300)));
console.log('=== 警告 (' + warnings.length + ') ===');
warnings.slice(0, 5).forEach(e => console.log(' -', e.slice(0, 200)));

await browser.close();
process.exit(errors.length > 0 ? 1 : 0);
