const assert=require('assert/strict');
const fs=require('fs');
const path=require('path');
const os=require('os');
const vm=require('vm');
const net=require('net');
const {spawn}=require('child_process');
const {chromium}=require('playwright-core');
const search=require('../js/search-utils');
const root=path.resolve(__dirname,'..');
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'js/data.js'),'utf8'),sandbox);
const defaults=JSON.parse(JSON.stringify(sandbox.window.ByVitDefaults));
const run=(q,goals=defaults.site.goals,products=defaults.products,options={})=>search.search(q,products,goals,options);
const ids=result=>result.items.map(item=>item.product.id);
assert.equal(search.normalize('  Ёлка / BCAA 2:1:1  '),'елка bcaa 2 1 1');
assert.equal(run('Хочу набрать массу').goal.id,'mass');
assert.equal(run('масса').goal.id,'mass');
assert.equal(run('хочу накачать мышцы').goal.id,'mass');
assert.equal(run('Нужно быстрее восстанавливаться').goal.id,'recovery');
assert.deepEqual(ids(run('Протеин для массы')),[1,13,10]);
assert.deepEqual(ids(run('пратеин для массы')),[1,13,10]);
assert.equal(run('пратеин для массы').typo,true);
assert.equal(run('хочу набрать масу').goal.id,'mass');
assert.deepEqual(ids(run('Optimum Nutrition')),[1,13]);
assert.deepEqual(ids(run('оптимум нутришн')),[1,13]);
assert.deepEqual(ids(run('Magnesium')),[5]);
assert.deepEqual(ids(run('магний')),[5]);
assert.deepEqual(ids(run('whey')),[1,13]);
assert.equal(run('сила и восстановление').status,'ambiguous');
assert.equal(run('сила и восстановление',defaults.site.goals,defaults.products,{goalId:'strength'}).goal.id,'strength');
for(const q of ['без кофеина','не хочу набирать массу','протеин для похудения','лечение диабета','x'.repeat(241)]){
  assert.equal(run(q).status,'restricted',q);
  assert.equal(run(q).items.length,0,q);
}
assert.equal(run('протеин для космоса').items.length,0,'Unknown intent must not be discarded');
const edited=structuredClone(defaults.site.goals);
edited[0].searchPhrases=['накачать бицепс'];
edited[0].productRules={10:{priority:99,reason:'Растительный белок: состав указан в карточке.'},999:{priority:999,reason:'Deleted product'}};
assert.equal(run('накачать бицепс',edited).goal.id,'mass');
assert.equal(run('набрать массу',edited).items.length,0,'Explicitly replaced phrases override defaults');
assert.equal(ids(run('протеин накачать бицепс',edited))[0],10);
assert.match(run('накачать бицепс',edited).items[0].reason,/Растительный/);
assert.equal(search.goalSettings(edited[0]).productRules[999],undefined);
edited[0].enabled=false;
assert.equal(run('накачать бицепс',edited).items.length,0);
const stockProducts=structuredClone(defaults.products);
stockProducts.find(product=>product.id===1).stock=0;
assert.equal(ids(run('whey',defaults.site.goals,stockProducts))[0],13);
assert.ok(ids(run('whey',defaults.site.goals,stockProducts)).includes(1),'Unavailable exact matches remain visible');
assert.deepEqual(ids(run('')) , defaults.products.map(product=>product.id),'Empty search preserves catalog order');
console.log('Search rules passed: goals, mixed queries, typos, exclusions, priorities and disabled goals.');

async function browserCheck(){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'byvit-search-check-'));
  const listener=net.createServer();
  await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));
  const port=listener.address().port;
  await new Promise(resolve=>listener.close(resolve));
  const baseURL=`http://127.0.0.1:${port}`;
  const password='SearchTestPassword!42';
  const child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,NODE_ENV:'test',PORT:String(port),BYVIT_PUBLIC_URL:baseURL,BYVIT_ALLOWED_ORIGINS:baseURL,BYVIT_DATA_DIR:directory,BYVIT_ADMIN_PASSWORD:password,BYVIT_SESSION_SECRET:'byvit-search-test-only-secret-not-production'}});
  let output='';
  child.stdout.on('data',chunk=>output+=chunk); child.stderr.on('data',chunk=>output+=chunk);
  let browser;
  try{
    for(let i=0;i<80;i++){
      try{if((await fetch(`${baseURL}/api/health`)).ok)break;}catch{}
      if(child.exitCode!==null)throw new Error(output);
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    const executablePath=[process.env.CHROME_PATH,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium'].filter(Boolean).find(file=>fs.existsSync(file));
    browser=await chromium.launch({executablePath,headless:true});
    const context=await browser.newContext({baseURL,viewport:{width:1384,height:900}});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('/index.html');
    await page.locator('[data-header-search-toggle]').click();
    const input=page.locator('[data-overlay-search-input]');
    const screenshots=process.env.BYVIT_E2E_SCREENSHOTS;
    if(screenshots)fs.mkdirSync(screenshots,{recursive:true});
    const checkShortcutStyle=async()=>{
      assert.equal(await page.locator('.header-goal-shortcuts [data-search-example]').count(),4);
      assert.equal(await page.locator('.header-search-shortcuts .search-examples').count(),0,'Empty search goals must not use chip styling');
      assert.equal(await page.locator('[data-header-search-shortcuts] a').count(),0,'Generic quick transitions are removed from search');
      assert.equal(await page.locator('[data-header-search-shortcuts]').getByText('Быстрый переход',{exact:true}).count(),0);
      const styles=await page.locator('.header-goal-shortcuts [data-search-example]').first().evaluate(node=>{
        const style=getComputedStyle(node), list=getComputedStyle(node.parentElement), last=getComputedStyle(node.parentElement.querySelector('[data-search-example]:nth-child(2)'));
        return {border:style.borderTopWidth,bottom:style.borderBottomWidth,right:style.borderRightWidth,lastRight:last.borderRightWidth,listBorder:list.borderTopWidth,columns:list.gridTemplateColumns.split(' ').length,background:style.backgroundColor,font:style.fontSize,minHeight:style.minHeight,height:node.getBoundingClientRect().height,mobile:matchMedia('(max-width:760px)').matches,narrow:matchMedia('(max-width:480px)').matches};
      });
      assert.equal(styles.border,'0px');assert.equal(styles.background,'rgba(0, 0, 0, 0)');assert.equal(styles.font,styles.mobile ? '15px' : '16px');assert.equal(styles.minHeight,'44px');assert.ok(styles.height>=43.99,JSON.stringify(styles));
      if(styles.mobile){assert.equal(styles.bottom,'1px');assert.equal(styles.right,styles.narrow ? '0px' : '1px');assert.equal(styles.lastRight,'0px');assert.equal(styles.listBorder,'1px');assert.equal(styles.columns,styles.narrow ? 1 : 2);}
      else{assert.equal(styles.bottom,'0px');assert.equal(styles.right,'0px');assert.equal(styles.listBorder,'0px');}
    };
    await checkShortcutStyle();
    if(screenshots){await page.waitForTimeout(400);await page.screenshot({path:path.join(screenshots,'search-goal-shortcuts-desktop.png')});}
    await page.locator('.header-goal-shortcuts [data-search-example]').first().press('Enter');
    await page.locator('[data-header-search-results] .header-result-link').first().waitFor();
    assert.match(await page.locator('[data-header-search-results]').textContent(),/Набор массы/);
    assert.equal(await page.locator('[data-header-search-results] .header-result-link').count(),5);
    await input.fill('протеин для массы');
    await page.locator('[data-header-search-results] .header-result-link').first().waitFor();
    assert.equal(await page.locator('[data-header-search-results] .header-result-link').count(),3);
    await page.locator('.search-all-results').click();
    await page.locator('#catalogProducts .product-card').first().waitFor();
    assert.equal(await page.locator('#catalogProducts .product-card').count(),3);
    assert.match(await page.locator('#catalogSearchState').textContent(),/Набор массы/);
    assert.equal(await page.locator('#catalogProducts .search-product-reason:visible').count(),3);
    await page.locator('#catalogSearch').fill('сила и восстановление');
    await page.locator('#catalogSearchState').getByRole('link',{name:'Сила и выносливость',exact:true}).click();
    await page.locator('#catalogProducts .product-card').first().waitFor();
    assert.equal(new URL(page.url()).searchParams.get('searchGoal'),'strength');
    assert.equal(await page.locator('#catalogProducts .product-card').count(),3);
    await page.locator('.catalog-filter-menu-all > summary').click();
    await page.locator('#stockOnly').check();
    assert.equal(new URL(page.url()).searchParams.get('searchGoal'),'strength','Filters preserve resolved intent');
    await page.locator('#catalogSearch').fill('Optimum Nutrition');
    assert.equal(new URL(page.url()).searchParams.has('searchGoal'),false,'Changing query clears chosen goal');
    assert.equal(await page.locator('#catalogProducts .product-card').count(),2);
    await page.locator('#catalogSearch').fill('без кофеина');
    assert.equal(await page.locator('#catalogProducts .product-card').count(),0);
    assert.match(await page.locator('#catalogSearchState').textContent(),/ограничения/);
    await page.goto('/catalog.html?q=протеин%20для%20массы');
    await page.locator('#catalogProducts .product-card').first().waitFor();
    if(screenshots){fs.mkdirSync(screenshots,{recursive:true});await page.waitForTimeout(700);await page.screenshot({path:path.join(screenshots,'smart-search-desktop.png')});}
    await page.setViewportSize({width:356,height:720});
    await page.goto('/index.html');
    await page.locator('[data-header-search-toggle]').click();
    for(const width of [320,356,390,480,481,520,760]){
      await page.setViewportSize({width,height:720});
      await checkShortcutStyle();
      const recovery=page.locator('.header-goal-shortcuts [data-search-example]').nth(2);
      await recovery.hover();
      assert.equal(await recovery.evaluate(node=>getComputedStyle(node).textDecorationLine),'none',`Mobile hover must not underline at ${width}px`);
      await recovery.focus();
      assert.equal(await recovery.evaluate(node=>getComputedStyle(node).textDecorationLine),'none',`Mobile focus must not underline at ${width}px`);
      const lines=await page.locator('.header-goal-shortcuts [data-search-example]').evaluateAll(nodes=>nodes.map(node=>{
        const range=document.createRange();range.selectNodeContents(node);return range.getClientRects().length;
      }));
      assert.ok(lines.every(count=>count===1),`Goal titles should fit one line at ${width}px: ${lines}`);
      const bounds=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
      assert.ok(bounds.scroll<=bounds.width+1,`Shortcuts must not overflow at ${width}px`);
    }
    await page.setViewportSize({width:356,height:720});
    if(screenshots){await page.waitForTimeout(400);await page.screenshot({path:path.join(screenshots,'search-goal-shortcuts-mobile.png')});}
    await page.locator('.header-goal-shortcuts [data-search-example]').first().click();
    assert.match(await page.locator('[data-header-search-results]').textContent(),/Набор массы/);
    await input.fill('хочу набрать массу');
    await page.locator('[data-header-search-results] .header-result-link').first().waitFor();
    const size=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(size.scroll<=size.width+1,'Mobile search must not overflow');
    if(screenshots){await page.waitForTimeout(400);await page.screenshot({path:path.join(screenshots,'smart-search-mobile.png')});}
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('[data-header-search-toggle]').evaluate(node=>node===document.activeElement),true);
    await page.goto('/catalog.html?q=протеин%20для%20массы');
    await page.locator('#catalogProducts .product-card').first().waitFor();
    assert.equal(await page.locator('#catalogProducts .search-product-reason:visible').count(),3);
    const cardLayout=await page.locator('#catalogProducts .product-card').first().evaluate(card=>{
      const reason=card.querySelector('.search-product-reason').getBoundingClientRect(), price=card.querySelector('.product-meta').getBoundingClientRect(), body=card.querySelector('.product-body').getBoundingClientRect();
      return {reasonBottom:reason.bottom,priceTop:price.top,priceBottom:price.bottom,bodyBottom:body.bottom};
    });
    assert.ok(cardLayout.reasonBottom<=cardLayout.priceTop && cardLayout.priceBottom<=cardLayout.bodyBottom,'Mobile reasons must not overlap or hide price/cart');
    if(screenshots){await page.waitForTimeout(700);await page.screenshot({path:path.join(screenshots,'smart-search-catalog-mobile.png')});}
    await page.setViewportSize({width:1384,height:900});
    await page.goto('/admin.html');
    await page.locator('#adminPassword').fill(password);
    await page.locator('#adminLoginForm button[type="submit"]').click();
    await page.locator('[data-admin-tab="goals"]').click();
    const goal=page.locator('[data-goal-key="mass"]');
    await goal.locator('.admin-goal-search > summary').click();
    await goal.locator('[data-goal-search-phrases]').fill('накачать бицепс\nнабрать массу');
    await goal.locator('[data-goal-search-rule="10"] [data-goal-search-priority]').fill('99');
    await goal.locator('[data-goal-search-rule="10"] [data-goal-search-reason]').fill('Растительный белок: состав указан в карточке.');
    await page.locator('[data-search-preview-query]').fill('протеин накачать бицепс');
    await page.locator('[data-search-preview]').click();
    assert.match(await page.locator('[data-search-preview-results]').textContent(),/Распознана цель: Набор массы/);
    const saved=page.waitForResponse(response=>response.url().endsWith('/api/admin/state') && response.request().method()==='PUT');
    await page.locator('#adminGoalsForm button[type="submit"]').click();
    assert.equal((await saved).status(),200);
    await page.reload();
    await page.locator('[data-admin-tab="goals"]').click();
    await goal.locator('.admin-goal-search > summary').click();
    assert.match(await goal.locator('[data-goal-search-phrases]').inputValue(),/накачать бицепс/);
    assert.equal(await goal.locator('[data-goal-search-rule="10"] [data-goal-search-priority]').inputValue(),'99');
    await page.goto('/catalog.html?q=протеин%20накачать%20бицепс');
    await page.locator('#catalogProducts .product-card').first().waitFor();
    assert.equal(await page.locator('#catalogProducts .product-card').first().getAttribute('data-product-id'),'10');
    assert.match(await page.locator('#catalogProducts .product-card').first().textContent(),/Растительный белок/);
    assert.deepEqual(errors,[]);
    console.log('Search browser checks passed: header/catalog parity, mobile, goal resolution, filters and persisted admin settings.');
  }finally{
    if(browser)await browser.close();
    child.kill('SIGTERM');
    await new Promise(resolve=>child.exitCode!==null?resolve():child.once('exit',resolve));
    fs.rmSync(directory,{recursive:true,force:true});
  }
}
if(process.argv.includes('--browser'))browserCheck().catch(error=>{console.error(error);process.exitCode=1;});
