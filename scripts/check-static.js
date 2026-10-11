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
    const brandContext=await browser.newContext();
    // A browser-only logo fixture verifies every placement without adding a real brand asset.
    const logoFixture='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="320"><rect x="30" y="16" width="540" height="288" fill="#113d30"/></svg>');
    await brandContext.route('**/'+manifest['js/data.js'],route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(dist,manifest['js/data.js']),'utf8')+`\nwindow.ByVitDefaults.site.brandImages['Optimum Nutrition']={src:${JSON.stringify(logoFixture)}};`}));
    const brandPage=await brandContext.newPage();
    const brandErrors=[];
    brandPage.on('pageerror',error=>brandErrors.push(error.message));
    brandPage.on('response',response=>{if(response.status()>=400)brandErrors.push(`${response.status()} ${response.url()}`);});
    const brandHtml=fs.readFileSync(path.join(dist,'brands/optimum-nutrition.html'),'utf8');
    assert.match(brandHtml,/<title>Optimum Nutrition — купить с доставкой по Беларуси \| BYVIT<\/title>/);
    assert.match(brandHtml,/<h1>Optimum Nutrition<\/h1>/);
    assert.match(brandHtml,/rel="canonical" href="https:\/\/mihed1991.github.io\/by_vit\/brands\/optimum-nutrition.html"/);
    assert.ok(fs.readFileSync(path.join(dist,'sitemap.xml'),'utf8').includes('/brands/optimum-nutrition.html'));
    await brandPage.goto(`http://127.0.0.1:${server.address().port}/by_vit/brands.html`,{waitUntil:'networkidle'});
    await brandPage.locator('.brand-card[href="brands/optimum-nutrition.html"]').click();
    await brandPage.locator('.product-card').first().waitFor();
    assert.deepEqual(await brandPage.locator('.product-card').evaluateAll(nodes=>nodes.map(node=>Number(node.dataset.productId))),[1,13]);
    assert.equal(await brandPage.locator('input[name="brand"]').count(),0);
    assert.match(await brandPage.locator('link[rel="canonical"]').getAttribute('href'),/\/by_vit\/brands\/optimum-nutrition.html$/);
    await brandPage.locator('#catalogSort').selectOption('price-desc');
    await brandPage.waitForURL('**/by_vit/brands/optimum-nutrition.html?sort=price-desc');
    assert.equal(await brandPage.locator('.product-card').first().getAttribute('data-product-id'),'13');
    assert.ok(!brandPage.url().includes('id='),'Static detail filters must retain the generated page identity');
    await brandPage.locator('.product-card[data-product-id="1"] h3 a').click();
    await brandPage.waitForURL('**/by_vit/product.html?id=1');
    await brandPage.goBack();
    await brandPage.locator('.product-card').first().waitFor();
    await brandPage.setViewportSize({width:363,height:720});
    assert.ok(await brandPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    for(const width of [1384,363]){
      await brandPage.setViewportSize({width,height:900});
      for(const [file,selector] of [['index.html',width>760?'#homeBrands img[alt="Optimum Nutrition"]':'.mv-brand-rail img[alt="Optimum Nutrition"]'],['brands.html','#brandsList img[alt="Optimum Nutrition"]'],['brands/optimum-nutrition.html','.brand-page-logo img']]){
        await brandPage.goto(`http://127.0.0.1:${server.address().port}/by_vit/${file}`,{waitUntil:'networkidle'});
        const logo=brandPage.locator(selector).first();
        await logo.evaluate(image=>image.decode());
        const box=await logo.evaluate(image=>{
          const media=image.parentElement;
          const bounds=media.getBoundingClientRect();
          const rect=image.getBoundingClientRect();
          const style=getComputedStyle(media);
          return {width:rect.width,height:rect.height,availableWidth:bounds.width-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-parseFloat(style.borderLeftWidth)-parseFloat(style.borderRightWidth),availableHeight:bounds.height-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom)-parseFloat(style.borderTopWidth)-parseFloat(style.borderBottomWidth),fit:getComputedStyle(image).objectFit};
        });
        assert.equal(box.fit,'contain');
        assert.ok(box.width>0&&box.height>0&&box.width<=box.availableWidth+1&&box.height<=box.availableHeight+1,`${file} (${width}px): logo must fit within its padded container without clipping`);
      }
    }
    assert.deepEqual(brandErrors,[],'Nested static brand pages must resolve all links and assets');
    await brandContext.close();
    const blogContext=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
    const blogPage=await blogContext.newPage(),blogErrors=[],apiRequests=[];
    blogPage.on('pageerror',error=>blogErrors.push(error.message));
    blogPage.on('response',response=>{if(response.status()>=400)blogErrors.push(`${response.status()} ${response.url()}`);});
    blogPage.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/'))apiRequests.push(request.url());});
    const blogHtml=fs.readFileSync(path.join(dist,'blog/kak-chitat-kartochku-tovara.html'),'utf8');
    assert.match(blogHtml,/<h1>Как читать карточку товара перед покупкой<\/h1>/);
    assert.match(blogHtml,/"@type":"BlogPosting"/);
    assert.ok(blogHtml.includes('href="blog/kak-chitat-kartochku-tovara.html#section-'),'SSR contents anchors must stay on the nested article even with a base URL');
    assert.ok(fs.readFileSync(path.join(dist,'sitemap.xml'),'utf8').includes('/blog/kak-chitat-kartochku-tovara.html'));
    await blogPage.goto(`http://127.0.0.1:${server.address().port}/by_vit/blog.html`);
    await blogPage.locator('.blog-card[href="blog/kak-chitat-kartochku-tovara.html"]').click();
    await blogPage.locator('#articleRelated .product-card').first().waitFor();
    assert.equal(await blogPage.locator('#articleRelated .product-card').count(),3);
    assert.match(await blogPage.locator('link[rel="canonical"]').getAttribute('href'),/\/by_vit\/blog\/kak-chitat-kartochku-tovara.html$/);
    await blogPage.locator('.article-cover img').evaluate(image=>image.decode());
    await blogPage.locator('[data-action="cart"][data-id="1"]').click();
    assert.equal(await blogPage.locator('[data-action="cart"][data-id="1"]').getAttribute('aria-pressed'),'true');
    await blogPage.setViewportSize({width:390,height:844});
    await blogPage.locator('.blog-card').first().click();
    await blogPage.locator('.article-prose').waitFor();
    for(const width of [356,1440]){
      await blogPage.setViewportSize({width,height:720});
      await blogPage.goto(`http://127.0.0.1:${server.address().port}/by_vit/blog/fasovka-i-tsena-kak-sravnivat.html`);
      await blogPage.locator('.article-contents summary').click();
      const targets=await blogPage.locator('.article-contents a').evaluateAll(links=>links.map(link=>({href:link.href,id:new URL(link.href).hash.slice(1),text:link.textContent})));
      assert.equal(targets.length,3);
      for(const target of targets){
        assert.equal(new URL(target.href).pathname,'/by_vit/blog/fasovka-i-tsena-kak-sravnivat.html');
        await blogPage.locator('.article-contents a').filter({hasText:target.text}).click();
        assert.equal(new URL(blogPage.url()).pathname,'/by_vit/blog/fasovka-i-tsena-kak-sravnivat.html');
        assert.equal(new URL(blogPage.url()).hash,'#'+target.id);
        await blogPage.waitForFunction(id=>{
          const heading=document.getElementById(id),header=document.querySelector('.site-header');
          const top=heading.getBoundingClientRect().top;
          return top>=(header?.getBoundingClientRect().bottom || 0) && top<innerHeight;
        },target.id,{timeout:5000});
      }
    }
    assert.ok(await blogPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.deepEqual(apiRequests,[],'Static blog must not require Node API');
    assert.deepEqual(blogErrors,[],'Nested static article paths must resolve links and media');
    await blogContext.close();
    console.log('Static release cache, legacy browser data, PNG icons and mobile media checks passed.');
  }finally{
    if(browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => {console.error(error); process.exitCode = 1;});
