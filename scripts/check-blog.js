const assert=require('assert/strict');
const fs=require('fs');
const path=require('path');
const os=require('os');
const net=require('net');
const {spawn}=require('child_process');
const {chromium}=require('playwright-core');
const blog=require('../js/blog-utils');
const root=path.resolve(__dirname,'..');
const screenshotDir=process.env.BYVIT_E2E_SCREENSHOTS;

async function main(){
  assert.equal(blog.slug('Как выбрать фасовку?'),'kak-vybrat-fasovku');
  assert.equal(blog.media('javascript:alert(1)'), '');
  assert.equal(blog.media('assets/../server.js'), '');
  assert.equal(blog.media('data:image/svg+xml;base64,AAAA'), '');
  assert.equal(blog.date('2026-02-31'),'');
  assert.equal(blog.normalize({posts:[{id:'one',title:'First'},{id:'one',title:'Duplicate'}]}).posts.length,1);
  const example={id:'private-draft',title:'Private draft',excerpt:'Private excerpt',publishedAt:'2026-10-11',category:'Тестовая рубрика',status:'draft',blocks:[{type:'paragraph',text:'PRIVATE_DRAFT_CONTENT_975'}],productIds:['1']};
  assert.equal(blog.published({posts:[example]}).length,0);
  assert.ok(blog.article(blog.normalize({posts:[{...example,title:'<script>alert(1)</script>'}]}).posts[0]).includes('&lt;script&gt;'));
  assert.equal(blog.validate({posts:[{...example,id:'../escape'}]}).length>0,true);
  const largeListing=blog.listing({posts:Array.from({length:500},(_,i)=>({...example,id:'large-'+i,status:'published'}))},{page:28});
  const largePagination=largeListing.match(/<nav class="blog-pagination"[\s\S]*?<\/nav>/)[0];
  assert.equal((largePagination.match(/<a /g)||[]).length,5,'Large archives keep compact first/current/last and previous/next navigation');
  assert.ok(largeListing.includes('Страница 28 из 56') && largeListing.includes('Показано 244–252'));

  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'byvit-blog-check-'));
  const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
  const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const baseURL=`http://127.0.0.1:${port}`, password='BlogQaPassword!42';
  const child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,NODE_ENV:'test',PORT:String(port),BYVIT_PUBLIC_URL:baseURL,BYVIT_ALLOWED_ORIGINS:baseURL,BYVIT_DATA_DIR:directory,BYVIT_UPLOAD_DIR:path.join(directory,'uploads'),BYVIT_BACKUP_DIR:path.join(directory,'backups'),BYVIT_ADMIN_PASSWORD:password},stdio:['ignore','pipe','pipe']});
  let output='', browser;
  child.stderr.on('data',chunk=>{output+=chunk;});
  const request=(route,options={})=>fetch(baseURL+route,options);
  try{
    let ready=false;
    for(let i=0;i<100;i++){try{if((await request('/api/health')).ok){ready=true;break;}}catch(error){}if(child.exitCode!==null)throw new Error(output);await new Promise(resolve=>setTimeout(resolve,100));}
    assert.ok(ready,'Test server must start');
    const state=await (await request('/api/state')).json();
    assert.equal(state.site.blog.posts.length,3);
    const firstPost=state.site.blog.posts.find(post=>post.productIds.length===3), slug=firstPost.id;
    const html=await (await request('/article.html?id='+slug)).text();
    assert.ok(html.includes('<h1>'+firstPost.title+'</h1>'),'Article must be rendered without JavaScript');
    assert.ok(html.includes('"@type":"BlogPosting"'));
    assert.equal((await request('/article.html?id=missing')).status,404);
    const login=await request('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:baseURL},body:JSON.stringify({password})});
    assert.ok(login.ok);const cookie=login.headers.get('set-cookie').split(';')[0];
    const put=body=>request('/api/admin/state',{method:'PUT',headers:{'Content-Type':'application/json',Origin:baseURL,Cookie:cookie},body:JSON.stringify(body)});
    const adminState=await (await request('/api/admin/state',{headers:{Cookie:cookie}})).json();
    adminState.site.blog.posts.push(example,{...example,id:'archived-post',status:'archived',blocks:[{type:'paragraph',text:'PRIVATE_ARCHIVE_CONTENT_975'}]});
    assert.ok((await put(adminState)).ok);
    const publicText=await (await request('/api/state')).text();
    assert.ok(!publicText.includes('PRIVATE_DRAFT_CONTENT_975') && !publicText.includes('PRIVATE_ARCHIVE_CONTENT_975'),'Public API must not disclose drafts or archive');
    assert.equal((await request('/article.html?id=private-draft')).status,404);
    const sitemap=await (await request('/sitemap.xml')).text();
    assert.ok(sitemap.includes('blog.html') && !sitemap.includes('private-draft'));
    const invalid=structuredClone(adminState);invalid.site.blog.posts[0].cover='javascript:alert(1)';
    assert.equal((await put(invalid)).status,400,'Unsafe images must be rejected before saving');

    const executablePath=[process.env.CHROME_PATH,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium'].filter(Boolean).find(p=>fs.existsSync(p));
    browser=await chromium.launch({executablePath,headless:true});
    const context=await browser.newContext({baseURL,viewport:{width:1440,height:900},deviceScaleFactor:2,reducedMotion:'reduce'});
    const page=await context.newPage(),errors=[];page.on('pageerror',err=>errors.push(err.message));
    await page.goto('/blog.html');await page.locator('.blog-card').first().waitFor();
    assert.equal(await page.locator('.blog-card').count(),3);
    await page.locator('.blog-topics a').filter({hasText:'Покупка и доставка'}).click();
    assert.equal(await page.locator('.blog-card').count(),1);
    assert.ok(page.url().includes('topic='));
    await page.goto('/article.html?id='+slug);await page.locator('#articleReading h1').waitFor();
    assert.equal(await page.locator('#articleRelated .product-card').count(),3);
    await page.locator('.article-contents summary').click();
    await page.locator('.article-contents a').first().click();
    assert.ok(page.url().includes('#section-'));
    await page.locator('[data-action="cart"][data-id="1"]').first().click();
    assert.equal(await page.locator('[data-action="cart"][data-id="1"]').first().getAttribute('aria-pressed'),'true');
    for(const width of [320,390,760,820,1100,1440]){
      await page.setViewportSize({width,height:900});
      await page.goto('/blog.html');await page.locator('.blog-card').first().waitFor();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Blog must not overflow at '+width);
      const columns=await page.locator('.blog-grid').evaluate(node=>getComputedStyle(node).gridTemplateColumns.split(' ').length);
      assert.equal(columns,width<=760?1:width<=1100?2:3);
      if(screenshotDir && [390,1440].includes(width)){fs.mkdirSync(screenshotDir,{recursive:true});await page.screenshot({path:path.join(screenshotDir,`blog-${width}.png`),fullPage:true});}
      await page.goto('/article.html?id='+slug);await page.locator('.article-prose').waitFor();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Article must not overflow at '+width);
      assert.ok(await page.locator('.article-reading').evaluate(n=>n.getBoundingClientRect().width)<=740);
      if(screenshotDir && [390,1440].includes(width)){await page.screenshot({path:path.join(screenshotDir,`article-${width}.png`),fullPage:true});await page.screenshot({path:path.join(screenshotDir,`article-viewport-${width}.png`)});}
    }
    await page.goto('/index.html');await page.locator('.home-blog-desktop .blog-card').first().waitFor();
    assert.equal(await page.locator('.home-blog-desktop .blog-card').count(),3);
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.locator('.home-blog-mobile').isVisible(),true);
    assert.equal(await page.locator('.home-blog-desktop').isVisible(),false);
    assert.equal(await page.locator('.mobile-bottom-nav a').count(),5);
    for(const width of [320,356,373,390,760]){
      await page.setViewportSize({width,height:844});
      const edges=await page.locator('.home-blog-mobile').evaluate(section=>{
        const bounds=selector=>{const r=section.querySelector(selector).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height};};
        return {label:bounds('.eyebrow'),heading:bounds('.section-head h2'),link:bounds('.text-link'),card:bounds('.blog-card'),border:getComputedStyle(section.querySelector('.section-head')).borderTopWidth,kickerLine:getComputedStyle(section.querySelector('.eyebrow'),'::before').display};
      });
      for(const node of ['label','heading','card'])assert.ok(Math.abs(edges[node].left-16)<1,'Mobile home gutter must align at 16px: '+node+'/'+width);
      assert.ok(Math.abs(edges.card.right-(width-16))<1);
      assert.ok(Math.abs(edges.link.right-(width-16))<1,'All articles must align to the right gutter: '+width);
      assert.ok(edges.link.left-edges.heading.right>=11,'Heading and link must have a gap: '+width);
      assert.ok(Math.abs((edges.heading.top+edges.heading.bottom)-(edges.link.top+edges.link.bottom))<2,'All articles must share the title row: '+width);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Home must not overflow at '+width);
      assert.equal(edges.border,'0px');assert.equal(edges.kickerLine,'none');assert.ok(edges.link.height>=44);
      if(screenshotDir && width===356){await page.locator('.home-blog-mobile .section-head').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(screenshotDir,'blog-home-mobile-356.png')});}
    }
    await page.setViewportSize({width:390,height:844});
    await page.locator('.home-blog-mobile .section-head').scrollIntoViewIfNeeded();
    if(screenshotDir)await page.screenshot({path:path.join(screenshotDir,'blog-home-mobile-viewport.png')});
    await page.goto('/blog.html');await page.locator('#blogTopic').waitFor({state:'visible'});
    assert.equal(await page.locator('.blog-topics').isVisible(),false);
    await page.locator('#blogTopic').selectOption('Покупка и доставка');
    await page.locator('.blog-card').first().waitFor();assert.equal(await page.locator('.blog-card').count(),1);
    assert.ok(page.url().includes('topic='));
    await page.locator('#blogTopic').selectOption('');await page.locator('.blog-card').nth(2).waitFor();

    await page.setViewportSize({width:1440,height:900});
    await page.goto('/admin.html');await page.locator('#adminPassword').fill(password);await page.locator('#adminLoginForm button').click();
    await page.locator('[data-admin-tab="blog"]').click();await page.locator('#blogPostForm').waitFor({state:'visible'});
    assert.ok((await page.locator('#admin-blog').textContent()).includes('1200 × 600'));
    await page.locator('#blogPostTitle').fill('Тестовая публикация BYVIT');
    await page.locator('#blogPostId').fill('test-publication');
    await page.locator('#blogPostExcerpt').fill('Краткое описание <script>window.blogXss=1</script>');
    await page.locator('#blogPostCategory').fill('Проверка');
    await page.locator('[data-block-text]').fill('Первый абзац. <img src=x onerror=alert(1)>');
    await page.locator('#blogBlockType').selectOption('heading');await page.locator('[data-blog-block-add]').click();
    await page.locator('[data-blog-block="heading"] [data-block-text]').fill('Тестовый подзаголовок');
    await page.locator('[data-blog-block="heading"] [data-blog-block-move="-1"]').click();
    assert.equal(await page.locator('[data-blog-block]').first().getAttribute('data-blog-block'),'heading');
    await page.locator('[data-blog-block="heading"] [data-blog-block-move="1"]').click();
    assert.equal(await page.locator('[data-blog-block]').first().getAttribute('data-blog-block'),'paragraph');
    await page.locator('#blogPostCover').fill('assets/blog-choice.svg');
    await page.locator('[data-blog-product][value="1"]').check();
    await page.locator('[data-blog-preview="mobile"]').click();
    const frame=page.frameLocator('#blogPreviewFrame');await frame.locator('h1').waitFor();
    assert.equal(await frame.locator('script').count(),0,'Preview never runs article HTML');
    assert.equal(await page.locator('#blogPreviewFrame').getAttribute('sandbox'),'');
    assert.ok(await page.locator('#blogPreviewFrame').evaluate(n=>n.clientWidth)<=390);
    await page.locator('[data-blog-preview-close]').click();
    await page.locator('[data-blog-preview="desktop"]').click();
    assert.ok(await page.locator('#blogPreviewFrame').evaluate(n=>n.clientWidth)>760,'Desktop preview must use a desktop layout, not the editor column width');
    await page.keyboard.press('Escape');
    await page.locator('#blogSaveButton').click();await page.locator('#blogPostSaved').filter({hasText:'сохранена'}).waitFor();
    assert.ok(!(await (await request('/api/state')).text()).includes('test-publication'));
    assert.equal((await request('/article.html?id=test-publication')).status,404);
    await page.locator('#blogPostStatus').selectOption('published');
    await page.locator('#blogSaveButton').click();await page.locator('#blogPostSaved').filter({hasText:'сохранена'}).waitFor();
    const published=await (await request('/api/state')).json();assert.ok(published.site.blog.posts.some(p=>p.id==='test-publication'));
    await page.reload();await page.locator('[data-admin-tab="blog"]').click();
    assert.ok((await page.locator('#blogAdminList').textContent()).includes('Тестовая публикация BYVIT'));
    await page.locator('[data-blog-edit="test-publication"]').click();
    await page.locator('#blogHomeDesktop').uncheck();await page.locator('#blogHomeMobile').check();
    await page.locator('#blogSettingsForm button[type="submit"]').click();await page.locator('#blogSettingsStatus').filter({hasText:'сохранены'}).waitFor();
    const downloadPromise=page.waitForEvent('download');await page.locator('[data-blog-export]').click();
    const exported=JSON.parse(fs.readFileSync(await (await downloadPromise).path(),'utf8'));
    assert.equal(exported.posts.every(post=>post.status==='published'),true);
    assert.equal(JSON.stringify(exported).includes('PRIVATE_DRAFT_CONTENT_975'),false);
    assert.equal(Object.hasOwn(exported,'orders'),false);
    if(screenshotDir){await page.screenshot({path:path.join(screenshotDir,'blog-admin.png'),fullPage:true});await page.screenshot({path:path.join(screenshotDir,'blog-admin-viewport.png')});}
    await page.goto('/article.html?id=test-publication');await page.locator('.article-prose').waitFor();
    assert.equal(await page.locator('.article-prose script,.article-prose img').count(),0);
    assert.equal(await page.locator('#articleRelated .product-card').count(),1);
    await page.goto('/index.html');await page.locator('.home-blog-desktop').waitFor({state:'attached'});
    assert.equal(await page.locator('.home-blog-desktop').isVisible(),false);
    await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('.home-blog-mobile').isVisible(),true);
    await page.goto('/article.html?id=missing');await page.locator('.article-missing h1').waitFor();
    assert.ok((await page.locator('meta[name="robots"]').getAttribute('content')).includes('noindex'));
    // Pagination and empty state use the real public API, not browser-local admin data.
    const current=await (await request('/api/admin/state',{headers:{Cookie:cookie}})).json();
    current.site.blog.posts.push(...Array.from({length:11},(_,i)=>({...example,id:'pagination-'+i,title:'Статья '+i,status:'published',category:'Проверка пагинации'})));
    assert.ok((await put(current)).ok);
    await page.goto('/blog.html?topic='+encodeURIComponent('Проверка пагинации')+'&page=2');await page.locator('.blog-card').first().waitFor();
    assert.equal(await page.locator('.blog-card').count(),2);
    assert.equal(await page.locator('.blog-pagination [aria-current]').textContent(),'2');
    current.site.blog.posts.push(...Array.from({length:90},(_,i)=>({...example,id:'many-topic-'+i,title:'Материал '+i,status:'published',category:'Рубрика '+i%12})));
    assert.ok((await put(current)).ok);
    for(const width of [320,373,390,1440]){
      await page.setViewportSize({width,height:900});await page.goto('/blog.html');await page.locator('#blogTopic').waitFor({state:'visible'});
      assert.ok(await page.locator('#blogTopic option').count()>12);
      assert.equal(await page.locator('.blog-topics').isVisible(),false);
      assert.equal(await page.locator('.blog-card').count(),9);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Many rubrics must not overflow at '+width);
      if(screenshotDir && [390,1440].includes(width))await page.screenshot({path:path.join(screenshotDir,`blog-many-topics-${width}.png`)});
    }
    await page.setViewportSize({width:390,height:900});
    await page.goto('/blog.html?topic='+encodeURIComponent('Проверка пагинации')+'&page=2');
    await page.locator('.blog-pagination').scrollIntoViewIfNeeded();
    if(screenshotDir)await page.screenshot({path:path.join(screenshotDir,'blog-pagination-mobile.png')});
    await page.locator('#blogTopic').selectOption('Рубрика 0');await page.locator('.blog-card').first().waitFor();
    assert.equal(await page.locator('.blog-card').count(),8);assert.ok(!new URL(page.url()).searchParams.has('page'),'Changing rubric resets pagination');
    current.site.blog.posts=[];assert.ok((await put(current)).ok);
    await page.goto('/blog.html');await page.locator('.empty-state h2').waitFor();
    assert.equal(await page.locator('.blog-card').count(),0);
    if(screenshotDir)await page.screenshot({path:path.join(screenshotDir,'blog-empty.png')});
    await page.goto('/index.html');await page.locator('.home-blog-mobile').waitFor({state:'attached'});assert.equal(await page.locator('.home-blog-mobile').isVisible(),false);
    assert.deepEqual(errors,[],'No browser runtime errors');
    console.log('Blog checks passed: SSR, private drafts/archive, validation, editor/save/reload, safe preview, products/cart, topics, pagination, empty states and 6 responsive widths.');
  }finally{if(browser)await browser.close();child.kill('SIGTERM');await new Promise(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',resolve);});fs.rmSync(directory,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
