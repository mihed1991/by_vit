const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const {spawn} = require('child_process');
const {chromium} = require('playwright-core');
const brands = require('../js/brand-utils');
const root = path.resolve(__dirname,'..');
const screenshots = process.env.BYVIT_E2E_SCREENSHOTS;
async function main(){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'byvit-brands-check-'));
  const portProbe=net.createServer();
  await new Promise(resolve=>portProbe.listen(0,'127.0.0.1',resolve));
  const port=portProbe.address().port;
  await new Promise(resolve=>portProbe.close(resolve));
  const baseURL=`http://127.0.0.1:${port}`;
  const password='BrandQaPassword!42';
  const child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,NODE_ENV:'test',PORT:String(port),BYVIT_PUBLIC_URL:baseURL,BYVIT_ALLOWED_ORIGINS:baseURL,BYVIT_DATA_DIR:directory,BYVIT_UPLOAD_DIR:path.join(directory,'uploads'),BYVIT_BACKUP_DIR:path.join(directory,'backups'),BYVIT_ADMIN_PASSWORD:password},stdio:['ignore','pipe','pipe']});
  let output='',browser;
  child.stderr.on('data',chunk=>{output+=chunk;});
  try{
    for(let i=0;i<80;i++){
      try{if((await fetch(baseURL+'/api/health')).ok)break;}catch(error){}
      if(child.exitCode!==null)throw new Error(output);
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    const state=await (await fetch(baseURL+'/api/state')).json();
    const originalProducts=structuredClone(state.products);
    state.site.brandProfiles={'Optimum Nutrition':{summary:'Краткое описание бренда для проверки.',description:'Первый абзац.\n\n<script> — текст, а не код.',seoTitle:'Optimum Nutrition — тест BYVIT'},'Empty Brand':{summary:'Ассортимент скоро появится.'}};
    state.site.brandImages={'Optimum Nutrition':{src:'assets/byvit-header-wordmark.svg'}};
    const collisions=brands.list([{brand:'A B'},{brand:'A-B'},{brand:'Белый бренд'}],{});
    assert.equal(new Set(collisions.map(brand=>brand.id)).size,3);
    const executablePath=[process.env.CHROME_PATH,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium'].filter(Boolean).find(file=>fs.existsSync(file));
    browser=await chromium.launch({executablePath,headless:true});
    const context=await browser.newContext({baseURL,viewport:{width:1384,height:900}});
    await context.route('**/api/state',route=>route.fulfill({json:state}));
    const page=await context.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('/brands.html');
    await page.locator('.brand-card[href="brand.html?id=optimum-nutrition"]').click();
    await page.locator('.product-card').first().waitFor();
    assert.equal(await page.title(),'Optimum Nutrition — тест BYVIT');
    assert.equal(await page.locator('.page-hero h1').textContent(),'Optimum Nutrition');
    assert.deepEqual(await page.locator('.product-card').evaluateAll(nodes=>nodes.map(node=>Number(node.dataset.productId))),[1,13]);
    assert.equal(await page.locator('#catalogSearch').count(),0);
    assert.equal(await page.locator('input[name="brand"]').count(),0);
    assert.equal(await page.locator('input[name="category"]').count(),1);
    await page.locator('.brand-page-logo img').evaluate(image=>image.decode());
    await page.locator('.brand-page-description > summary').click();
    assert.equal(await page.locator('.brand-page-description script').count(),0);
    assert.equal(await page.locator('.brand-page-description p').count(),2);
    await page.locator('.brand-page-description > summary').press('Enter');
    assert.equal(await page.locator('.brand-page-description').getAttribute('open'),null);
    await page.locator('#catalogSort').selectOption('price-desc');
    await page.waitForURL('**/brand.html?id=optimum-nutrition&sort=price-desc');
    assert.equal(await page.locator('.product-card').first().getAttribute('data-product-id'),'13');
    await page.locator('.catalog-filter-menu-all > summary').click();
    await page.locator('#catalogPriceMin').fill('1000');
    await page.locator('.empty-state h2').waitFor();
    await page.getByRole('button',{name:'Сбросить фильтры',exact:true}).click();
    await page.locator('.product-card').first().waitFor();
    assert.deepEqual(await page.locator('.product-card').evaluateAll(nodes=>nodes.map(node=>Number(node.dataset.productId))),[1,13]);
    assert.match(page.url(),/brand.html\?id=optimum-nutrition$/);
    await page.locator('[data-action="cart"][data-id="1"]').click();
    assert.equal(await page.locator('[data-action="cart"][data-id="1"]').getAttribute('aria-pressed'),'true');
    for(const width of [320,363,375,760,820,1100,1384]){
      await page.setViewportSize({width,height:804});
      await page.goto('/brand.html?id=optimum-nutrition');
      await page.locator('.product-card').first().waitFor();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Brand page must not overflow');
      assert.equal(await page.locator('.catalog-filter-row').evaluate(node=>getComputedStyle(node).display),'flex','Brand filters must reuse the catalogue row styling');
      assert.equal(await page.locator('.brand-sort').isVisible(),width>760,'Mobile brand pages must not retain an empty sort label');
      assert.equal(await page.locator('.brand-page-description').getAttribute('open'),null);
      await page.locator('.catalog-filter-menu-all > summary').click();
      assert.equal(await page.locator('input[name="brand"]').count(),0);
      await page.locator('.catalog-filter-menu-all > summary').press('Escape');
      if(screenshots && [375,1384].includes(width)){
        fs.mkdirSync(screenshots,{recursive:true});
        await page.locator('.page-hero h1').click();
        await page.waitForTimeout(400);
        await page.screenshot({path:path.join(screenshots,`brand-${width}.png`)});
      }
    }
    state.products.push(...Array.from({length:35},(_,i)=>({...originalProducts[0],id:200+i,brand:'Pagination Brand'})));
    await page.goto('/brand.html?id=pagination-brand');
    await page.locator('.product-card').first().waitFor();
    assert.equal(await page.locator('.product-card').count(),30);
    await page.getByRole('button',{name:'Страница 2',exact:true}).click();
    assert.equal(await page.locator('.product-card').count(),5);
    await page.goBack();assert.equal(await page.locator('.product-card').count(),30);
    await page.goto('/brand.html?id=empty-brand');
    await page.getByRole('heading',{name:'Товары бренда скоро появятся'}).waitFor();
    await page.goto('/brand.html?id=unknown');
    await page.getByRole('heading',{name:'Бренд не найден'}).waitFor();
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex, nofollow');
    await page.goto('/catalog.html?brand=Optimum%20Nutrition');
    await page.locator('.product-card').first().waitFor();
    assert.equal(await page.locator('.product-card').count(),2,'Old catalogue links must work');
    assert.deepEqual(errors,[]);
    await context.close();
    const adminContext=await browser.newContext({baseURL,viewport:{width:1440,height:900}});
    const admin=await adminContext.newPage();
    await admin.goto('/admin.html');await admin.locator('#adminPassword').fill(password);
    await admin.locator('#adminLoginForm button[type="submit"]').click();
    await admin.locator('[data-admin-tab="brands"]').click();
    const editor=admin.locator('[data-brand-image-key="Optimum Nutrition"]');
    await editor.locator('[data-brand-profile="summary"]').fill('Сохранённое описание Optimum Nutrition.');
    await editor.locator('[data-brand-profile="description"]').fill('Подробности бренда.\n\nБез изменения товаров.');
    await editor.locator('.admin-goal-details > summary').click();
    await editor.locator('[data-brand-profile="seoTitle"]').fill('Optimum Nutrition — сохранённый SEO title');
    await editor.locator('[data-brand-profile="seoDescription"]').fill('SEO-описание бренда.');
    assert.equal(await editor.getByRole('link',{name:'Открыть страницу бренда'}).getAttribute('href'),'brand.html?id=optimum-nutrition');
    await Promise.all([admin.waitForResponse(response=>response.url().endsWith('/api/admin/state')&&response.request().method()==='PUT'&&response.status()===200),admin.locator('#adminBrandsForm button[type="submit"]').click()]);
    await admin.reload();await admin.locator('[data-admin-tab="brands"]').click();
    assert.equal(await editor.locator('[data-brand-profile="summary"]').inputValue(),'Сохранённое описание Optimum Nutrition.');
    const saved=await (await fetch(baseURL+'/api/state')).json();
    assert.deepEqual(saved.products,originalProducts,'Editing brands must not alter products');
    const html=await (await fetch(baseURL+'/brand.html?id=optimum-nutrition&stock=1')).text();
    assert.match(html,/<title>Optimum Nutrition — сохранённый SEO title<\/title>/);
    assert.match(html,/Сохранённое описание Optimum Nutrition/);
    assert.match(html,/rel="canonical" href="[^"]*brand.html\?id=optimum-nutrition"/);
    assert.match(await (await fetch(baseURL+'/sitemap.xml')).text(),/brand.html\?id=optimum-nutrition/);
    await admin.goto('/brand.html?id=optimum-nutrition');
    await admin.locator('.product-card').first().waitFor();
    assert.equal(await admin.title(),'Optimum Nutrition — сохранённый SEO title');
    await adminContext.close();
    console.log('Brand identities, detail routes, scoped filters/reset, old URLs, pagination/back, cart, responsive layouts, server SEO and admin persistence passed.');
  }finally{
    if(browser)await browser.close();
    if(child.exitCode===null){child.kill('SIGTERM');await new Promise(resolve=>child.once('exit',resolve));}
    fs.rmSync(directory,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
