const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const {execFileSync} = require('child_process');
const {chromium} = require('playwright-core');

const root = path.resolve(__dirname,'..');
const dist = path.join(root,'dist');
const sha = body => crypto.createHash('sha256').update(body).digest('hex').slice(0,12);
const mime = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.mp4':'video/mp4', '.woff2':'font/woff2', '.json':'application/json'};

async function main(){
  execFileSync(process.execPath,['scripts/build-static.js'],{cwd:root,stdio:'inherit'});
  const manifest = JSON.parse(fs.readFileSync(path.join(dist,'asset-manifest.json'),'utf8'));
  for(const [original,versioned] of Object.entries(manifest)){
    const body = fs.readFileSync(path.join(dist,versioned));
    assert.ok(versioned.includes(`.${sha(body)}.`), `Content hash must match ${original}`);
  }
  for(const file of fs.readdirSync(dist).filter(file => file.endsWith('.html'))){
    const html = fs.readFileSync(path.join(dist,file),'utf8');
    for(const rel of ['icon','apple-touch-icon']) assert.match(html,new RegExp(`rel="${rel}"[^>]+href="assets/[^"?]+\\.[a-f0-9]{12}\\.png"`));
    assert.ok(html.includes(`type="image/svg+xml" sizes="any" href="${manifest['assets/favicon.svg']}"`), 'Published pages must advertise the supplied SVG favicon');
    assert.ok(html.includes(`type="image/png" sizes="96x96" href="${manifest['assets/favicon-96.png']}"`), 'Published pages must advertise the 96×96 PNG favicon');
    assert.match(html,/src="js\/app\.[a-f0-9]{12}\.js"/);
    assert.match(html,/href="css\/style\.[a-f0-9]{12}\.css"/);
    assert.ok(!html.includes('src="js/app.js?'), 'Published app script must have a content-addressed URL');
  }
  const executablePath = [process.env.CHROME_PATH,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium'].filter(Boolean).find(file => fs.existsSync(file));
  if(!executablePath) throw new Error('Chrome/Chromium is required for static preview checks.');
  const server = http.createServer((req,res) => {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const relative = pathname.replace(/^\/by_vit\//,'').replace(/^\//,'') || 'index.html';
    const file = path.resolve(dist,relative);
    if(!file.startsWith(dist + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()){
      res.writeHead(404); res.end('Not found'); return;
    }
    res.writeHead(200,{'Content-Type':mime[path.extname(file)] || 'application/octet-stream','Cache-Control':'public, max-age=600'});
    res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
    browser = await chromium.launch({executablePath,headless:true});
    const context = await browser.newContext();
    const legacy = {
      byvit_v60_site:JSON.stringify({heroTitle:'Старый баннер',heroMediaMode:'image',heroMediaSrc:'assets/product-whey.jpg',header:{brandImage:'assets/product-creatine.jpg'},mobileHome:{heroTitle:'Старый мобильный баннер'}}),
      byvit_v60_products:JSON.stringify([{id:1,name:'Старый товар',price:1,images:['assets/product-creatine.jpg']}]),
      byvit_v60_cart:JSON.stringify([{id:1,qty:2,packageId:'900g',flavor:'Ваниль'}]),
      byvit_v60_wishlist:JSON.stringify([1,2]),
      byvit_v60_compare:JSON.stringify([1,2])
    };
    await context.addInitScript(values => Object.entries(values).forEach(([key,value]) => localStorage.setItem(key,value)),legacy);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror',error => errors.push(error.message));
    page.on('response',response => { if(response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    await page.setViewportSize({width:1440,height:900});
    await page.goto(`http://127.0.0.1:${server.address().port}/by_vit/index.html`,{waitUntil:'networkidle'});
    await page.locator('body.home-ready').waitFor();
    assert.equal(await page.locator('#heroTitle').textContent(),'Забота о себе в каждой детали');
    assert.equal(await page.locator('.hero .hero-desktop-media').getAttribute('src'),manifest['assets/hero-default.webp']);
    assert.equal(await page.locator('.site-header .brand-desktop-logo img').getAttribute('src'),manifest['assets/byvit-desktop-logo.png']);
    assert.equal(await page.locator('#featuredProducts .product-card h3').first().textContent(),'100% Whey Protein');
    const retained = await page.evaluate(keys => Object.fromEntries(keys.map(key => [key,localStorage.getItem(key)])),Object.keys(legacy));
    assert.deepEqual(retained,legacy,'Refreshing published data must not erase saved settings, cart, wishlist or comparison');
    for(const [selector,size] of [['link[rel="icon"][type="image/svg+xml"]',1000],['link[rel="icon"][type="image/png"]',96],['link[rel="apple-touch-icon"]',180]]){
      const href = await page.locator(selector).getAttribute('href');
      const dimensions = await page.evaluate(async href => {
        const image = new Image(); image.src = href; await image.decode();
        return [image.naturalWidth,image.naturalHeight];
      },href);
      assert.deepEqual(dimensions,[size,size]);
    }
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.locator('.site-header .brand-mobile-logo img').getAttribute('src'),manifest['assets/byvit-mobile-logo.png']);
    assert.equal(await page.locator('.mv-hero h1').textContent(),'Результаты начинаются здесь');
    const background = await page.locator('.mv-hero').evaluate(node => getComputedStyle(node).backgroundImage);
    assert.ok(background.includes(manifest['assets/home-mobile-hero.jpg']),'Mobile CSS backgrounds must use fingerprinted media');
    await page.locator('.site-header .brand-mobile-logo img').evaluate(image => image.decode());
    assert.deepEqual(errors,[],'Published media and SVG icon references must all resolve');
    if(process.env.BYVIT_E2E_SCREENSHOTS){
      fs.mkdirSync(process.env.BYVIT_E2E_SCREENSHOTS,{recursive:true});
      await page.screenshot({path:path.join(process.env.BYVIT_E2E_SCREENSHOTS,'static-mobile-refresh.png')});
    }
    await page.goto(`http://127.0.0.1:${server.address().port}/by_vit/goals.html`,{waitUntil:'networkidle'});
    assert.equal(await page.locator('.goal-selection-card').count(),6);
    await page.locator('.goal-selection-card[href="goal.html?id=recovery"]').click();
    await page.locator('#catalogProducts .product-card').first().waitFor();
    assert.equal(await page.locator('.page-hero h1').textContent(),'Восстановление');
    assert.deepEqual(await page.locator('#catalogProducts .product-card').evaluateAll(nodes=>nodes.map(node=>Number(node.dataset.productId))),[1,13,3,4,5,10]);
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    assert.ok(canonical.includes('/by_vit/goal.html?id=recovery'), 'Goal canonical must retain the GitHub Pages base path');
    assert.equal(await page.locator('#catalogSort').count(),0);
    assert.equal(await page.locator('#catalogSearch').count(),0);
    assert.equal(await page.locator('#goalNavigation').getAttribute('open'),null);
    assert.equal(await page.locator('.toolbar').count(),0);
    await page.setViewportSize({width:1440,height:900});
    assert.equal(await page.locator('#catalogSort, .toolbar').count(),0);
    assert.equal(await page.locator('#catalogSearch').count(),0);
    await page.locator('#goalNavigation > summary').click();
    await page.locator('#goalNavigation [aria-current="page"] .goal-navigation-check').waitFor();
    await page.locator('#goalNavigation > summary').press('Escape');
    await page.locator('.catalog-filter-menu-all > summary').click();
    await page.locator('#stockOnly').check();
    await page.waitForURL('**/goal.html?id=recovery&stock=1');
    assert.match(page.url(),/id=recovery/);
    assert.deepEqual(errors,[],'Goal routes and assets must resolve in the published subdirectory');
    await context.close();
    console.log('Static release cache, legacy browser data, PNG icons and mobile media checks passed.');
  }finally{
    if(browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => {console.error(error); process.exitCode = 1;});
