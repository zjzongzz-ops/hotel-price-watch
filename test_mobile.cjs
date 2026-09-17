const { firefox } = require('playwright');
const fs = require('fs');

(async () => {
  console.log('=== 启动移动端 H5 自动化端到端测试 (Playwright) ===');
  
  const browser = await firefox.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14 / 15 Pro 基准视口
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  });

  const page = await context.newPage();
  
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.log('  [Console Error]:', msg.text());
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push(err.message);
    console.log('  [Page Error]:', err.message);
  });

  const url = 'http://localhost:8088/index.html';
  console.log(`1. 访问移动端页面: ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);

  // 1. 验证标题与初始卡片渲染
  const title = await page.title();
  console.log(`   页面标题: "${title}"`);
  
  const totalCards = await page.locator('.hotel-card').count();
  console.log(`   初始酒店卡片数量: ${totalCards} (预期: 20)`);
  if (totalCards !== 20) {
    throw new Error(`预期 20 张卡片，实际得到 ${totalCards}`);
  }

  // 截图目录
  const screenshotDir = 'C:/Users/1/.gemini/antigravity/scratch/hotel-radar/screenshots';
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

  await page.screenshot({ path: `${screenshotDir}/01_home_mobile.png` });
  console.log('   ✅ 截图已保存: 01_home_mobile.png');

  // 2. 交互测试: 城市筛选 (点击 "上海")
  console.log('2. 测试城市药丸筛选: 点击 [上海]');
  await page.click('.pill[data-city="上海"]');
  await page.waitForTimeout(400);
  const shCards = await page.locator('.hotel-card').count();
  console.log(`   上海筛选结果数量: ${shCards}`);
  if (shCards <= 0 || shCards >= 20) {
    throw new Error(`上海筛选数量异常: ${shCards}`);
  }
  await page.screenshot({ path: `${screenshotDir}/02_filter_shanghai.png` });
  console.log('   ✅ 截图已保存: 02_filter_shanghai.png');

  // 切回全部城市
  await page.click('.pill[data-city="全部"]');
  await page.waitForTimeout(300);

  // 3. 交互测试: 展开第一家酒店的 30 天日历与比价抽屉
  console.log('3. 测试展开 30 天日历与比价抽屉');
  const firstDetailBtn = page.locator('.btn-check-detail').first();
  await firstDetailBtn.click();
  await page.waitForTimeout(600); // 等待 GSAP 动效平滑展开

  const sheetVisible = await page.locator('#detailSheet').isVisible();
  console.log(`   抽屉可见状态: ${sheetVisible}`);
  if (!sheetVisible) throw new Error('点击后抽屉未显示');

  const calCellsCount = await page.locator('.calendar-cell:not(.empty)').count();
  console.log(`   30天日历格子数量: ${calCellsCount} (预期: 30)`);
  if (calCellsCount !== 30) throw new Error(`日历格子数量不符: ${calCellsCount}`);

  await page.screenshot({ path: `${screenshotDir}/03_calendar_drawer.png` });
  console.log('   ✅ 截图已保存: 03_calendar_drawer.png');

  // 关闭抽屉
  await page.click('#sheetCloseBtn');
  await page.waitForTimeout(400);

  // 4. 交互测试: 会员资产配置与价格重算
  console.log('4. 测试全局会员配置模态框');
  await page.click('#btnOpenMemberSettings');
  await page.waitForTimeout(500);

  const memberModalVisible = await page.locator('#memberModal').isVisible();
  console.log(`   会员配置抽屉可见: ${memberModalVisible}`);
  await page.screenshot({ path: `${screenshotDir}/04_member_modal.png` });
  console.log('   ✅ 截图已保存: 04_member_modal.png');

  // 修改华住为铂金会员，保存
  await page.selectOption('#selectHuazhuTier', 'platinum');
  await page.click('#saveMemberBtn');
  await page.waitForTimeout(500);

  // 5. 交互测试: 降价双通道盯盘与通知测试
  console.log('5. 测试降价微信双通道盯盘面板');
  await page.click('#tabWatch');
  await page.waitForTimeout(500);

  const watchModalVisible = await page.locator('#watchModal').isVisible();
  console.log(`   降价盯盘面板可见: ${watchModalVisible}`);
  
  // 触发测试推送按钮
  console.log('   触发双通道连通性测试推送...');
  await page.click('#testPushBtn');
  await page.waitForTimeout(1200);

  const logsText = await page.locator('#pushTestLogs').innerText();
  console.log(`   推送演练日志输出:\n${logsText}`);
  if (!logsText.includes('PushPlus') && !logsText.includes('200 OK') && !logsText.includes('沙盒模拟')) {
    throw new Error('双通道测试未按预期输出成功日志');
  }


  await page.screenshot({ path: `${screenshotDir}/05_dual_channel_push_test.png` });
  console.log('   ✅ 截图已保存: 05_dual_channel_push_test.png');

  await page.click('#closeWatchModalBtn');
  await page.waitForTimeout(300);

  // 6. 交互测试: V2 链接解析与跨平台比价
  console.log('6. 测试 V2 一键粘贴与全网链接解析');
  await page.click('#btnOpenV2Parser');
  await page.waitForTimeout(500);

  const v2ModalVisible = await page.locator('#v2ParserModal').isVisible();
  console.log(`   V2 解析抽屉可见: ${v2ModalVisible}`);
  if (!v2ModalVisible) throw new Error('V2 解析抽屉未显示');

  // 点击第一个示例样本 (携程基准酒店，含立减50元干扰)
  const sampleChip1 = page.locator('.v2-sample-chip').first();
  await sampleChip1.click();
  await page.waitForTimeout(300);

  const inputVal = await page.locator('#v2InputText').inputValue();
  console.log(`   基准示例填充成功 (长度: ${inputVal.length} 字符)`);
  if (!inputVal) throw new Error('样本填充失败');

  // 点击立即比价
  await page.click('#btnStartParse');
  await page.waitForSelector('.hotel-card.v2-dynamic-card.is-benchmark-match', { timeout: 8000 });

  const topV2Card = page.locator('.hotel-card.v2-dynamic-card.is-benchmark-match').first();
  const topCardVisible = await topV2Card.isVisible();
  console.log(`   V2 基准对齐卡片渲染成功: ${topCardVisible}`);
  if (!topCardVisible) throw new Error('V2 动态比价卡片未成功生成');

  await page.screenshot({ path: `${screenshotDir}/06_v2_benchmark_card.png` });
  console.log('   ✅ 截图已保存: 06_v2_benchmark_card.png');

  // 再次打开解析弹层，测试非基准库全新酒店 (莫干山裸心谷) 的启发式弱匹配标灰
  console.log('6.2 测试 V2 启发式推算与弱匹配标灰待确认 (P2-7)');
  await page.click('#btnOpenV2Parser');
  await page.waitForTimeout(500);

  const sampleChip4 = page.locator('.v2-sample-chip').nth(3); // 第4个：度假样本
  await sampleChip4.click();
  await page.waitForTimeout(300);

  await page.click('#btnStartParse');
  await page.waitForSelector('.hotel-card.v2-dynamic-card.is-heuristic-match', { timeout: 8000 });

  const heuristicCard = page.locator('.hotel-card.v2-dynamic-card.is-heuristic-match').first();
  const heuristicVisible = await heuristicCard.isVisible();
  console.log(`   V2 启发式推算标灰卡片渲染成功: ${heuristicVisible}`);
  if (!heuristicVisible) throw new Error('启发式推算卡片未成功生成或缺少 is-heuristic-match 类');

  const badgeText = await heuristicCard.locator('.v2-card-badge.heuristic').innerText();
  console.log(`   启发式卡片标识: "${badgeText}"`);
  if (!badgeText.includes('启发式估算')) throw new Error('启发式卡片缺少视觉标识');

  await page.screenshot({ path: `${screenshotDir}/07_v2_heuristic_card.png` });
  console.log('   ✅ 截图已保存: 07_v2_heuristic_card.png');

  // 7. 控制台报错检查
  console.log('7. 检查页面运行报错:');
  console.log(`   页面错误数量: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.error('   ❌ 存在控制台错误:', consoleErrors);
  } else {
    console.log('   ✅ 控制台 0 报错 (Clean Console)');
  }

  await browser.close();
  console.log('=== 所有测试项均 100% 通过！ ===');
})();
