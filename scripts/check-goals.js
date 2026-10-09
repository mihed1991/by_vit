const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const {spawn} = require('child_process');
const {chromium} = require('playwright-core');

const root = path.resolve(__dirname, '..');
const password = 'GoalTestPassword!42';
const screenshots = process.env.BYVIT_E2E_SCREENSHOTS;
async function freePort(){
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function noOverflow(page){
  const bounds = await page.evaluate(() => ({width:document.documentElement.clientWidth, scroll:document.documentElement.scrollWidth}));
  assert.ok(bounds.scroll <= bounds.width + 1, `${page.url()} overflows: ${JSON.stringify(bounds)}`);
}
async function equalGoalGrid(page, columns){
  const grid = await page.locator('#goalsIndex').evaluate(node=>({
    columns:getComputedStyle(node).gridTemplateColumns.split(' ').length,
    cards:[...node.querySelectorAll('.goal-selection-card')].map(card=>{
      const box=card.getBoundingClientRect();
      return {width:box.width,height:box.height};
    })
  }));
  assert.equal(grid.columns,columns);
  assert.ok(grid.cards.length>0);
  for(const dimension of ['width','height']){
    const values=grid.cards.map(card=>card[dimension]);
    assert.ok(Math.max(...values)-Math.min(...values)<1, `Goal cards must have equal ${dimension} with ${grid.cards.length} goals`);
  }
}
async function main(){
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'byvit-goals-check-'));
  const port = await freePort();
  const baseURL = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd:root,
    env:{...process.env,NODE_ENV:'test',PORT:String(port),BYVIT_PUBLIC_URL:baseURL,BYVIT_ALLOWED_ORIGINS:baseURL,BYVIT_DATA_DIR:directory,BYVIT_BACKUP_DIR:path.join(directory,'backups'),BYVIT_UPLOAD_DIR:path.join(directory,'uploads'),BYVIT_ADMIN_PASSWORD:password},
    stdio:['ignore','pipe','pipe']
  });
  let browser;
  let output = '';
  child.stderr.on('data', chunk => { output += chunk; });
  child.stdout.on('data', chunk => { output += chunk; });
  try{
    for(let attempt=0;attempt<80;attempt++){
      try{ if((await fetch(`${baseURL}/api/health`)).ok) break; }catch(error){}
      if(child.exitCode !== null) throw new Error(output);
      await new Promise(resolve => setTimeout(resolve,100));
    }
    const state = await (await fetch(`${baseURL}/api/state`)).json();
    const originalProducts = structuredClone(state.products);
    const defaults = {window:{}};
    require('vm').runInNewContext(fs.readFileSync(path.join(root,'js/data.js'),'utf8'), defaults);
    state.site.goals ||= structuredClone(defaults.window.ByVitDefaults.site.goals);
    const legacyMass = state.site.goals.find(goal=>goal.id==='mass');
    delete legacyMass.productIds;
    legacyMass.href = 'catalog.html?category=protein';
    const recovery = state.site.goals.find(goal => goal.id === 'recovery');
    recovery.productIds = [2,4,5,999999];
    recovery.description = 'Первый абзац.\n\nВторой абзац <script> — обычный текст.';
    recovery.seoTitle = 'Восстановление — тестовая подборка | ByVit';
    state.site.goals.push({id:'empty-test',title:'Пустая подборка',text:'Товары скоро появятся',productIds:[]});
    state.site.goals.push({id:'disabled-test',title:'Скрытая цель',productIds:[1],enabled:false});
    state.site.goals.push({id:'custom-test',title:'Своя ссылка',href:'catalog.html?category=minerals',productIds:[]});
    const many = Array.from({length:35},(_,index)=>({...structuredClone(state.products[0]),id:1000+index,name:`Тестовый товар ${index+1}`}));
    state.products.push(...many);
    state.site.goals.push({id:'many-test',title:'Большая подборка с длинным названием для адаптивной проверки',productIds:many.map(product=>product.id)});
    const executablePath = [process.env.CHROME_PATH,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium'].filter(Boolean).find(file=>fs.existsSync(file));
    browser = await chromium.launch({executablePath,headless:true});
    const context = await browser.newContext({baseURL,viewport:{width:1384,height:900}});
    await context.route('**/api/state', route => route.fulfill({json:state}));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error=>errors.push(error.message));
    await page.goto('/catalog.html');
    await page.locator('#catalogProducts .product-card').first().waitFor();
    assert.equal(await page.locator('#catalogSmart').count(),0);
    await page.locator('#catalogSearch').fill('Magnesium');
    await page.waitForURL('**/catalog.html?q=Magnesium');
    assert.match(page.url(),/q=Magnesium/);
    assert.ok(await page.locator('#catalogProducts .product-card').count()<30);
    assert.equal(await page.locator('#catalogProducts .product-card[data-product-id="5"]').count(),1);
    await page.locator('#catalogSearch').fill('');
    await page.waitForURL('**/catalog.html');
    await page.locator('#catalogSort').selectOption('price-desc');
    await page.waitForURL('**/catalog.html?sort=price-desc');
    const mostExpensive = state.products.toSorted((a,b)=>b.price-a.price)[0];
    assert.equal(await page.locator('#catalogProducts .product-card').first().getAttribute('data-product-id'),String(mostExpensive.id));
    assert.equal(await page.locator('#catalogCategoryContext').isVisible(),false);
    const top = await page.locator('#catalogProducts').evaluate(node=>node.getBoundingClientRect().top);
    assert.ok(top < 500, 'Products must appear before the old category matrix occupied the screen');
    if(screenshots){ fs.mkdirSync(screenshots,{recursive:true}); await page.screenshot({path:path.join(screenshots,'catalog-clean-desktop.png')}); }
    await page.goto('/catalog.html?category=protein');
    await page.locator('#catalogCategoryContext').waitFor();
    await page.locator('#catalogCategoryContext').getByRole('link',{name:'Изолят',exact:true}).click();
    await page.locator('#catalogProducts .product-card').first().waitFor();
    assert.match(page.url(),/category=protein/);
    assert.match(page.url(),/q=whey/);
    const subgroupIds = await page.locator('#catalogProducts .product-card').evaluateAll(nodes=>nodes.map(node=>Number(node.dataset.productId)));
    assert.deepEqual(subgroupIds.slice(0,2),[1,13]);
    assert.ok(subgroupIds.every(id=>state.products.find(product=>product.id===id)?.category==='protein'), 'Subgroups must stay within their category');
    await page.goto('/goals.html');
    await page.locator('.goal-selection-card').first().waitFor();
    await equalGoalGrid(page,3);
    const hoverCard=page.locator('.goal-selection-card').first();
    await page.mouse.move(0,0);
    const beforeHover=await hoverCard.evaluate(node=>({background:getComputedStyle(node).backgroundColor,border:getComputedStyle(node).borderTopColor}));
    await hoverCard.hover();
    await page.waitForTimeout(220);
    const afterHover=await hoverCard.evaluate(node=>({background:getComputedStyle(node).backgroundColor,border:getComputedStyle(node).borderTopColor}));
    assert.equal(afterHover.background,beforeHover.background,'Hover must not change goal card backgrounds');
    assert.notEqual(afterHover.border,beforeHover.border,'Hover must highlight the border like product cards');
    await page.mouse.move(0,0);
    assert.equal(await page.getByRole('link',{name:/Набор массы Протеин/}).getAttribute('href'),'goal.html?id=mass');
    assert.equal(await page.getByText('Скрытая цель',{exact:true}).count(),0);
    assert.equal(await page.getByRole('link',{name:/Своя ссылка/}).getAttribute('href'),'catalog.html?category=minerals');
    if(screenshots){ await page.waitForTimeout(800); await page.screenshot({path:path.join(screenshots,'goals-index-desktop.png')}); }
    const savedFixtureGoals=state.site.goals;
    const enabledGoals=savedFixtureGoals.filter(goal=>goal.enabled!==false);
    for(const count of [7,8,10]){
      state.site.goals=Array.from({length:count},(_,index)=>({...enabledGoals[index%enabledGoals.length],id:`layout-${index}`}));
      await page.goto('/goals.html');
      await page.waitForFunction(count=>document.querySelectorAll('.goal-selection-card').length===count,count);
      await equalGoalGrid(page,3);
      await noOverflow(page);
    }
    state.site.goals=savedFixtureGoals;
    await page.goto('/goals.html');
    await page.locator('.goal-selection-card').first().waitFor();
    await page.getByRole('link',{name:/Восстановление BCAA/}).click();
    await page.locator('#catalogProducts .product-card').first().waitFor();
    assert.deepEqual(await page.locator('#catalogProducts .product-card').evaluateAll(nodes=>nodes.map(node=>Number(node.dataset.productId))),[2,4,5]);
    assert.equal(await page.title(),recovery.seoTitle);
    assert.ok((await page.locator('link[rel="canonical"]').getAttribute('href')).endsWith('/goal.html?id=recovery'));
    assert.equal(await page.locator('#goalDescription p').count(),2);
    assert.equal(await page.locator('#goalDescription script').count(),0);
    assert.equal(await page.locator('#goalNavigation').getAttribute('open'),null);
    assert.equal(await page.locator('#goalNavigation nav').isVisible(),false);
    assert.equal(await page.locator('.goal-sidebar').count(),0);
    const fullWidth=await page.locator('.goal-catalog-layout').evaluate(node=>({layout:node.getBoundingClientRect().width,products:node.querySelector('.catalog-main').getBoundingClientRect().width}));
    assert.ok(Math.abs(fullWidth.layout-fullWidth.products)<1,'Goal products must use the full content width');
    assert.equal(await page.locator('#catalogSearch, #catalogSearchPanel').count(),0);
    assert.ok(await page.locator('[data-header-search-form]').count()>0);
    await noOverflow(page);
    if(screenshots){ await page.waitForTimeout(800); await page.screenshot({path:path.join(screenshots,'goal-desktop.png')}); }
    const productTop=await page.locator('#catalogProducts').evaluate(node=>node.getBoundingClientRect().top);
    await page.locator('#goalNavigation > summary').click();
    await page.locator('#goalNavigation nav a').first().waitFor();
    assert.equal(await page.locator('#goalNavigation [aria-current="page"] .goal-navigation-check').count(),1);
    assert.equal(await page.locator('#catalogProducts').evaluate(node=>node.getBoundingClientRect().top),productTop,'Opening the selector must not push products down');
    if(screenshots) await page.screenshot({path:path.join(screenshots,'goal-desktop-selector-open.png')});
    await page.locator('#goalNavigation [aria-current="page"]').focus();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#goalNavigation').getAttribute('open'),null);
    assert.equal(await page.locator('#goalNavigation > summary').evaluate(node=>node===document.activeElement),true);
    await page.locator('#goalNavigation > summary').press('Enter');
    await page.locator('#goalNavigation nav a').first().waitFor();
    await page.locator('.page-hero h1').click();
    assert.equal(await page.locator('#goalNavigation').getAttribute('open'),null);
    await page.locator('#goalNavigation > summary').click();
    await page.locator('#goalNavigation a[href="goal.html?id=mass"]').click();
    await page.waitForURL('**/goal.html?id=mass');
    await page.locator('#catalogProducts .product-card').first().waitFor();
    assert.equal(await page.locator('.page-hero h1').textContent(),'Набор массы');
    await page.goBack();
    await page.locator('#catalogProducts .product-card').first().waitFor();
    assert.equal(await page.locator('#catalogSort, .toolbar').count(),0);
    const layout = await page.locator('.catalog-main').evaluate(node=>({
      top:node.getBoundingClientRect().top,
      filtersTop:node.querySelector('#catalogFilters').getBoundingClientRect().top,
      filtersMargin:parseFloat(getComputedStyle(node.querySelector('#catalogFilters')).marginTop)
    }));
    assert.ok(layout.filtersTop-layout.top>=0 && layout.filtersTop-layout.top<=layout.filtersMargin+1,'Goal filters must start at the top of the content with no added toolbar gap');
    await page.goto('/goal.html?id=recovery&q=Magnesium');
    await page.locator('#catalogProducts .product-card').first().waitFor();
    assert.equal(await page.locator('#catalogProducts .product-card').count(),1);
    await page.locator('.catalog-filter-menu-all > summary').click();
    await page.locator('#stockOnly').check();
    await page.waitForURL('**/goal.html?id=recovery&q=Magnesium&stock=1');
    assert.match(page.url(),/q=Magnesium/,'Subgroup links must retain their query when applying filters without a search input');
    assert.equal(await page.locator('#catalogProducts .product-card').count(),1);
    await page.locator('.catalog-filter-menu-all [data-clear-filters]').click();
    assert.ok(!new URL(page.url()).searchParams.has('q'));
    assert.equal(await page.locator('#catalogProducts .product-card').count(),3);
    await page.goto('/goal.html?id=recovery&q=не%20существует');
    await page.getByRole('heading',{name:'По этим фильтрам товаров нет'}).waitFor();
    await page.getByRole('link',{name:'Сбросить фильтры',exact:true}).click();
    await page.locator('#catalogProducts .product-card').first().waitFor();
    await page.locator('[data-action="cart"][data-id="2"]').click();
    await page.goto('/cart.html');
    assert.match(await page.locator('main').textContent(),/Creatine Monohydrate/);
    await page.goto('/goal.html?id=empty-test');
    await page.getByRole('heading',{name:'Подборка пока пустая'}).waitFor();
    for(const id of ['does-not-exist','disabled-test']){
      await page.goto(`/goal.html?id=${id}`);
      await page.getByRole('heading',{name:'Подборка не найдена'}).waitFor();
      assert.equal(await page.locator('meta[name="robots"]').first().getAttribute('content'),'noindex, nofollow');
    }
    await page.goto('/goal.html?id=many-test');
    await page.locator('.product-card').first().waitFor();
    assert.equal(await page.locator('.product-card').count(),30);
    await page.getByRole('button',{name:'Страница 2',exact:true}).click();
    assert.equal(await page.locator('.product-card').count(),5);
    assert.match(page.url(),/id=many-test.*page=2/);
    await page.goBack();
    assert.equal(await page.locator('.product-card').count(),30);
    for(const width of [320,375,432,820,1100]){
      await page.setViewportSize({width,height:width===820?390:804});
      await page.goto('/goals.html');
      await page.locator('.goal-selection-card').first().waitFor();
      await equalGoalGrid(page,width<=760?1:2);
      if(screenshots && width===375) await page.screenshot({path:path.join(screenshots,'goals-index-mobile.png')});
      await noOverflow(page);
      await page.goto('/goal.html?id=recovery');
      await page.locator('.product-card').first().waitFor();
      assert.equal(await page.locator('#goalNavigation').getAttribute('open'),null);
      const chevron=page.locator('#goalNavigation .goal-navigation-chevron');
      assert.equal(await chevron.getAttribute('aria-hidden'),'true');
      const alignment=await chevron.evaluate(node=>{
        const icon=node.getBoundingClientRect(),summary=node.closest('summary').getBoundingClientRect();
        return {size:icon.width,offset:Math.abs(icon.y+icon.height/2-summary.y-summary.height/2)};
      });
      assert.equal(alignment.size,20);
      assert.ok(alignment.offset<1,'Goal chevron must be vertically centered');
      await page.locator('#goalNavigation > summary').click();
      await page.locator('#goalNavigation nav a').first().waitFor();
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('.goal-navigation-chevron')).transform==='matrix(-1, 0, 0, -1, 0, 0)');
      const popup=await page.locator('#goalNavigation nav').evaluate(node=>{
        const box=node.getBoundingClientRect();
        const bottomNav=document.querySelector('[data-mobile-bottom-nav]').getBoundingClientRect();
        return {left:box.left,right:box.right,top:box.top,bottom:box.bottom,limit:bottomNav.height?bottomNav.top:innerHeight,viewport:innerWidth};
      });
      assert.ok(popup.left>=0 && popup.right<=popup.viewport && popup.top>=0 && popup.bottom<=popup.limit+1,'Goal dropdown must fit phone and landscape viewports');
      if(screenshots && width===375) await page.screenshot({path:path.join(screenshots,'goal-mobile-selector-open.png')});
      const targets = await page.locator('#goalNavigation nav a').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().height));
      assert.ok(targets.every(height=>height>=48));
      await page.locator('#goalNavigation > summary').press('Enter');
      assert.equal(await page.locator('#goalNavigation').getAttribute('open'),null);
      assert.equal(await page.locator('#catalogSort').count(),0);
      assert.equal(await page.locator('#catalogSearch').count(),0);
      assert.equal(await page.locator('.toolbar').count(),0);
      await noOverflow(page);
      if(screenshots && width===375){ await page.waitForTimeout(800); await page.screenshot({path:path.join(screenshots,'goal-mobile.png')}); }
    }
    await page.setViewportSize({width:1101,height:900});
    assert.equal(await page.locator('#catalogSort, .toolbar').count(),0);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto('/goal.html?id=many-test');
    await page.locator('.product-card').first().waitFor();
    await noOverflow(page);
    assert.deepEqual(errors,[]);
    await context.close();

    // Admin persistence uses only the isolated test store, not production data.
    const adminContext = await browser.newContext({baseURL,viewport:{width:1440,height:900}});
    const admin = await adminContext.newPage();
    await admin.goto('/admin.html');
    await admin.locator('#adminPassword').fill(password);
    await admin.locator('#adminLoginForm button[type="submit"]').click();
    await admin.locator('[data-admin-tab="goals"]').click();
    const card = admin.locator('[data-goal-key="recovery"]');
    await card.locator('[data-goal-product]').first().waitFor();
    for(const input of await card.locator('[data-goal-product]').all()) if(await input.isChecked()) await input.uncheck();
    await card.locator('[data-goal-product][value="2"]').check();
    await card.locator('[data-goal-product][value="5"]').check();
    await card.locator('[data-goal-product-search]').fill('Magnesium');
    assert.equal(await card.locator('[data-goal-product-option]:visible').count(),1);
    await card.locator('[data-goal-title]').fill('Восстановление после нагрузки');
    await card.locator('.admin-goal-details > summary').click();
    await card.locator('[data-goal-description]').fill('Обновлённый текст подборки.');
    const originalGoalCount=await admin.locator('[data-goal-key]').count();
    await admin.locator('[data-goal-add]').click();
    await admin.locator('[data-goal-key]').last().locator('[data-goal-delete]').click();
    assert.equal(await admin.locator('[data-goal-key]').count(),originalGoalCount);
    await admin.locator('[data-goal-add]').click();
    const added=admin.locator('[data-goal-key]').last();
    const addedId=await added.getAttribute('data-goal-key');
    assert.equal(await added.locator('[data-goal-href]').inputValue(),`goal.html?id=${addedId}`);
    await added.locator('[data-goal-title]').fill('Здоровый сон');
    await added.locator('[data-goal-text]').fill('Поддержка спокойного отдыха и восстановления после нагрузок.');
    await added.locator('[data-goal-icon]').selectOption('leaf');
    await added.locator('[data-goal-product][value="5"]').check();
    await admin.locator('[data-goal-add]').click();
    const disabled=admin.locator('[data-goal-key]').last();
    await disabled.locator('[data-goal-title]').fill('Новая скрытая цель');
    await disabled.locator('[data-goal-enabled]').uncheck();
    assert.deepEqual(await card.locator('[data-goal-product]:checked').evaluateAll(inputs=>inputs.map(input=>Number(input.value))),[2,5], 'Admin selection before save');
    const saving = admin.waitForRequest(request=>request.method()==='PUT' && request.url().endsWith('/api/admin/state'));
    await admin.locator('#adminGoalsForm button[type="submit"]').click();
    const payload = (await saving).postDataJSON();
    assert.deepEqual(payload.site.goals.find(goal=>goal.id==='recovery').productIds,[2,5], 'Selection in persisted request');
    await admin.waitForFunction(async()=>{
      const state = await (await fetch('/api/state')).json();
      return state.site.goals?.some(goal=>goal.id==='recovery' && goal.title==='Восстановление после нагрузки') && state.site.goals.some(goal=>goal.title==='Здоровый сон');
    });
    const saved = await (await admin.request.get('/api/state')).json();
    assert.deepEqual(saved.site.goals.find(goal=>goal.id==='recovery').productIds,[2,5]);
    assert.deepEqual(saved.products,originalProducts,'Selecting products for a goal must not mutate the catalog');
    await admin.reload();
    await admin.locator('[data-admin-tab="goals"]').click();
    assert.equal(await admin.locator('[data-goal-key="recovery"] [data-goal-product]:checked').count(),2);
    assert.equal(await admin.locator(`[data-goal-key="${addedId}"] [data-goal-icon]`).inputValue(),'leaf');
    await admin.goto('/goals.html');
    await admin.locator('.goal-selection-card').first().waitFor();
    assert.equal(await admin.locator('.goal-selection-card').count(),originalGoalCount+1);
    assert.equal(await admin.getByText('Новая скрытая цель',{exact:true}).count(),0);
    await equalGoalGrid(admin,3);
    const newGoal=admin.locator(`.goal-selection-card[href="goal.html?id=${addedId}"]`);
    assert.match(await newGoal.textContent(),/Поддержка спокойного отдыха/);
    assert.equal(await newGoal.locator('use').getAttribute('href'),'assets/home-mobile-icons.svg#leaf');
    await newGoal.click();
    await admin.locator('.product-card').first().waitFor();
    assert.deepEqual(await admin.locator('.product-card').evaluateAll(nodes=>nodes.map(node=>Number(node.dataset.productId))),[5]);
    const detail = await admin.request.get('/goal.html?id=recovery');
    assert.match(await detail.text(), /<title>Восстановление после нагрузки — подбор добавок \| ByVit<\/title>/);
    await admin.goto('/goal.html?id=recovery');
    await admin.locator('.product-card').first().waitFor();
    assert.deepEqual(await admin.locator('.product-card').evaluateAll(nodes=>nodes.map(node=>Number(node.dataset.productId))),[2,5]);
    const sitemap = await (await admin.request.get('/sitemap.xml')).text();
    assert.match(sitemap,/goal.html\?id=recovery/);
    await adminContext.close();
    console.log('Goals: catalog context, cross-category selection, pagination/back, cart, empty/disabled states, responsive navigation, SEO and admin persistence passed.');
  }finally{
    if(browser) await browser.close();
    child.kill('SIGTERM');
    await new Promise(resolve=>child.exitCode!==null?resolve():child.once('exit',resolve));
    fs.rmSync(directory,{recursive:true,force:true});
  }
}
main().catch(error=>{ console.error(error); process.exitCode=1; });
