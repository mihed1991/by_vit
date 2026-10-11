(function(){
  'use strict';
  const blog=window.ByVitBlog, e=blog.escape;
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  let api, originalId='', dirty=false, uploadBusy=0;
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const data=()=>blog.normalize(api.getSite().blog);
  const field=(id,label,type='text',extra='')=>`<label>${label}<input id="${id}" type="${type}" ${extra}></label>`;
  function relatedProducts(post){
    const products=api.getProducts();
    const selected=post.productIds.map(id=>products.find(p=>String(p.id)===id)).filter(Boolean);
    return selected.length ? `<section class="article-related"><h2>Товары по теме</h2><div class="product-grid">${selected.map(api.productCard).join('')}</div></section>` : '';
  }
  function renderArticle(){
    const root=$('#articleReading'); if(!root)return;
    const id=window.BYVIT_ARTICLE_ID || new URLSearchParams(location.search).get('id');
    const post=blog.published(data()).find(p=>p.id===id);
    if(!post){
      root.innerHTML='<div class="article-missing"><h1>Статья не найдена</h1><p>Материал снят с публикации или ссылка устарела.</p><a class="btn btn-primary" href="blog.html">Все статьи</a></div>';
      $('#articleRelated').innerHTML='';
      document.title='Статья не найдена | BYVIT';api.meta('robots','noindex, nofollow');return;
    }
    root.innerHTML=blog.article(post);
    const candidates=blog.published(data()).filter(p=>p.id!==post.id).sort((a,b)=>Number(b.category===post.category)-Number(a.category===post.category)).slice(0,3);
    $('#articleRelated').innerHTML=relatedProducts(post)+(candidates.length ? `<section class="article-related"><h2>Читайте также</h2><div class="blog-grid">${candidates.map(p=>blog.card(p,window.BYVIT_STATIC===true)).join('')}</div></section>` : '');
    api.syncProducts();
    const title=post.seoTitle || `${post.title} | BYVIT`, description=post.seoDescription || post.excerpt;
    const url=api.absoluteUrl('/'+blog.href(post,window.BYVIT_STATIC===true));
    document.title=title;api.meta('description',description);api.social({title,description,url,image:post.cover || 'assets/hero-share.jpg'});
    api.meta('og:type','article',true);
    let canonical=$('link[rel="canonical"]');if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.append(canonical);}canonical.href=url;
    api.structured('seo-blog',blog.schema(post,url,post.cover ? api.absoluteUrl(post.cover):undefined));
  }
  function renderHome(){
    if(document.body.dataset.page!=='home')return;
    const settings=data(), posts=blog.published(settings).sort((a,b)=>Number(b.featured)-Number(a.featured)).slice(0,3);
    for(const mode of ['desktop','mobile']){
      const parent=mode==='mobile' ? $('.mv-home') : $('main');
      if(!parent)continue;
      let section=$(`.home-blog-${mode}`);
      if(!section){section=document.createElement('section');section.className=`home-blog home-blog-${mode}`;if(mode==='desktop')parent.insertBefore(section,$('#homeGallerySection'));else parent.append(section);}
      section.hidden=!posts.length || settings[mode==='desktop'?'homeDesktop':'homeMobile']===false;
      section.innerHTML=`<div class="container"><div class="section-head"><div><span class="eyebrow">Блог BYVIT</span><h2>${e(settings.homeTitle)}</h2></div><a class="text-link${mode==='desktop'?' home-section-link':''}" href="blog.html">Все статьи${mode==='mobile'?' →':''}</a></div><div class="blog-grid">${posts.map(p=>blog.card(p,window.BYVIT_STATIC===true)).join('')}</div></div>`;
    }
  }
  function render(){
    const listing=$('#blogListing');
    if(listing){const params=new URLSearchParams(location.search);listing.innerHTML=blog.listing(data(),{category:params.get('topic') || '',page:params.get('page'),staticMode:window.BYVIT_STATIC===true});}
    const topicForm=$('.blog-topic-picker');
    if(topicForm){topicForm.classList.add('is-enhanced');$('select',topicForm).addEventListener('change',()=>topicForm.requestSubmit());}
    renderArticle();renderHome();
    $$('.blog-card-cover img,.article-cover img,.article-prose figure img').forEach(image=>{
      const fallback=()=>{const label=document.createElement('span');label.className='blog-cover-fallback';label.textContent=image.closest('.blog-card-cover') ? 'BYVIT / ЖУРНАЛ' : 'Изображение не загрузилось';image.replaceWith(label);};
      image.addEventListener('error',fallback,{once:true});if(image.complete && !image.naturalWidth)fallback();
    });
    $$('[data-nav][href="blog.html"]').forEach(a=>a.classList.toggle('active',['blog','article'].includes(document.body.dataset.page)));
  }
  function adminMarkup(){
    return `<div class="admin-grid"><article class="admin-card"><h3>Публикации</h3><p>Черновики и архив не видны посетителям. Предпросмотр работает внутри админки.</p><button class="btn btn-primary" type="button" data-blog-new>Новая статья</button><div id="blogAdminList" class="blog-admin-list"></div><form class="admin-form" id="blogSettingsForm"><h3>Блог на главной</h3>${field('blogHomeTitle','Заголовок блока','text','maxlength="120"')}<label class="check-line"><input id="blogHomeDesktop" type="checkbox">Показывать на компьютере</label><label class="check-line"><input id="blogHomeMobile" type="checkbox">Показывать на телефоне</label><p>Показываются три последние статьи. Отмеченные «На главную» имеют приоритет. Если публикаций нет, блок скрыт.</p><button class="btn btn-primary" type="submit">Сохранить блок</button><p id="blogSettingsStatus" role="status"></p></form></article><article class="admin-card"><h3 id="blogEditorTitle">Новая статья</h3><form class="admin-form" id="blogPostForm">
      ${field('blogPostTitle','Заголовок','text','required maxlength="200"')}${field('blogPostId','Адрес статьи','text','required maxlength="100" pattern="[a-z0-9]+(-[a-z0-9]+)*"')}<p class="admin-hint">Латинские буквы, цифры и дефисы. После первого сохранения адрес закреплён, чтобы ссылки не ломались.</p>
      <div class="field-row">${field('blogPostCategory','Рубрика','text','required maxlength="80" list="blogCategories"')}<label>Статус<select id="blogPostStatus"><option value="draft">Черновик</option><option value="published">Опубликовано</option><option value="archived">Архив</option></select></label></div><datalist id="blogCategories"></datalist>
      <label>Краткое описание<textarea id="blogPostExcerpt" maxlength="600" rows="3"></textarea></label>
      <div class="field-row">${field('blogPostAuthor','Автор','text','maxlength="120"')}<label>Тип автора<select id="blogPostAuthorType"><option value="organization">Редакция / организация</option><option value="person">Человек</option></select></label></div>${field('blogPostAuthorRole','Должность или компетенция автора','text','maxlength="160"')}
      <div class="field-row">${field('blogPostDate','Дата публикации','date')}${field('blogPostUpdated','Дата обновления','date')}</div>
      <h4>Обложка</h4><p class="admin-hint">Рекомендуемый размер: <strong>1200 × 600 px (2:1)</strong>. Одна обложка для главной, списка и статьи на компьютере и телефоне. JPG, PNG или WebP; важные детали ближе к центру. Текст заголовка добавлять на изображение не нужно.</p>
      ${field('blogPostCover','Ссылка на обложку','text')}<label>Загрузить обложку<input type="file" id="blogCoverUpload" accept="image/png,image/jpeg,image/webp"></label>${field('blogPostCoverAlt','Описание изображения','text','maxlength="300"')}<img id="blogCoverPreview" class="blog-cover-preview" alt="Предпросмотр обложки" hidden>
      <h4>Содержание статьи</h4><p class="admin-hint">Добавляйте абзацы, подзаголовки, списки, изображения и примечания. Содержание формируется из подзаголовков. В списке — один пункт на строку. HTML не исполняется.</p><div id="blogBlocks"></div><div class="field-row"><select id="blogBlockType" aria-label="Тип нового блока"><option value="paragraph">Абзац</option><option value="heading">Подзаголовок</option><option value="list">Список</option><option value="image">Изображение</option><option value="note">Примечание</option></select><button class="btn btn-light" data-blog-block-add type="button">Добавить блок</button></div>
      <h4>Товары по теме</h4><p class="admin-hint">До четырёх товаров из каталога. Цены и наличие обновляются вместе с товаром.</p><input id="blogProductSearch" type="search" aria-label="Найти товар для статьи" placeholder="Найти товар"><div id="blogProductOptions" class="blog-product-options"></div>
      <h4>Поисковые системы</h4>${field('blogPostSeoTitle','SEO title (необязательно)','text','maxlength="200"')}<label>SEO description (необязательно)<textarea id="blogPostSeoDescription" rows="3" maxlength="600"></textarea></label><label class="check-line"><input id="blogPostFeatured" type="checkbox">На главную: показывать в первую очередь</label>
      <p id="blogPostError" class="blog-admin-error" role="alert"></p><div class="blog-block-actions"><button class="btn btn-primary" id="blogSaveButton" type="submit">Сохранить статью</button><button class="btn btn-light" type="button" data-blog-preview="desktop">Предпросмотр: компьютер</button><button class="btn btn-light" type="button" data-blog-preview="mobile">Предпросмотр: телефон</button></div><p id="blogPostSaved" role="status"></p>
      </form><dialog id="blogPreview" class="blog-preview" aria-label="Предпросмотр статьи" hidden><button class="btn btn-light" type="button" data-blog-preview-close autofocus>Закрыть предпросмотр</button><p>Предпросмотр несохранённой статьи. Кнопки покупки здесь неактивны.</p><iframe id="blogPreviewFrame" sandbox title="Предпросмотр статьи BYVIT"></iframe></dialog></article></div>`;
  }
  function blockMarkup(block={type:'paragraph',text:''}){
    const names={paragraph:'Абзац',heading:'Подзаголовок',list:'Список',image:'Изображение',note:'Примечание'};
    return `<div class="blog-block-editor" data-blog-block="${e(block.type)}"><strong>${names[block.type]}</strong>${block.type==='image' ? `<label>Ссылка на изображение<input data-block-src value="${e(block.src)}"></label><label>Загрузить изображение<input data-blog-block-upload type="file" accept="image/png,image/jpeg,image/webp"></label><label>Описание изображения<input data-block-alt value="${e(block.alt)}" maxlength="300"></label><label>Подпись<input data-block-caption value="${e(block.caption)}" maxlength="1000"></label>` : `<label>${block.type==='heading'?'Подзаголовок':'Текст'}<textarea data-block-text maxlength="20000" rows="${block.type==='heading'?2:5}">${e(block.text)}</textarea></label>`}<div class="blog-block-actions"><button class="btn btn-light" type="button" data-blog-block-move="-1" aria-label="Переместить блок выше">Выше</button><button class="btn btn-light" type="button" data-blog-block-move="1" aria-label="Переместить блок ниже">Ниже</button><button class="btn btn-light" type="button" data-blog-block-remove>Убрать блок</button></div></div>`;
  }
  function syncBlockControls(){const blocks=$$('[data-blog-block]');blocks.forEach((b,i)=>{$('[data-blog-block-move="-1"]',b).disabled=i===0;$('[data-blog-block-move="1"]',b).disabled=i===blocks.length-1;});}
  function coverPreview(){const image=$('#blogCoverPreview'),src=blog.media($('#blogPostCover').value);image.hidden=!src;image.src=src || '';}
  function populate(post){
    originalId=post.id || '';dirty=false;
    const bindings={Title:'title',Id:'id',Category:'category',Status:'status',Excerpt:'excerpt',Author:'author',AuthorType:'authorType',AuthorRole:'authorRole',Date:'publishedAt',Updated:'updatedAt',Cover:'cover',CoverAlt:'coverAlt',SeoTitle:'seoTitle',SeoDescription:'seoDescription'};
    Object.entries(bindings).forEach(([suffix,key])=>{$('#blogPost'+suffix).value=post[key] || (suffix==='Status'?'draft':suffix==='AuthorType'?'organization':'');});
    $('#blogPostId').readOnly=!!originalId;$('#blogPostFeatured').checked=post.featured===true;
    $('#blogEditorTitle').textContent=originalId ? 'Редактирование статьи' : 'Новая статья';
    $('#blogBlocks').innerHTML=(post.blocks || [{type:'paragraph',text:''}]).map(blockMarkup).join('');syncBlockControls();
    $('#blogProductOptions').innerHTML=api.getProducts().map(p=>`<label data-blog-product-option data-search="${e((p.name+' '+p.brand).toLowerCase())}"><input type="checkbox" value="${e(p.id)}" data-blog-product ${post.productIds?.includes(String(p.id))?'checked':''}><span>${e(p.brand)} · ${e(p.name)}</span></label>`).join('');
    $('#blogProductSearch').value='';$('#blogPostError').textContent='';$('#blogPostSaved').textContent='';$('#blogPreview').close();$('#blogPreview').hidden=true;coverPreview();
  }
  function readPost(){
    const post={id:$('#blogPostId').value.trim() || blog.slug($('#blogPostTitle').value),title:$('#blogPostTitle').value,category:$('#blogPostCategory').value,status:$('#blogPostStatus').value,excerpt:$('#blogPostExcerpt').value,author:$('#blogPostAuthor').value,authorType:$('#blogPostAuthorType').value,authorRole:$('#blogPostAuthorRole').value,publishedAt:$('#blogPostDate').value,updatedAt:$('#blogPostUpdated').value,cover:$('#blogPostCover').value.trim(),coverAlt:$('#blogPostCoverAlt').value,seoTitle:$('#blogPostSeoTitle').value,seoDescription:$('#blogPostSeoDescription').value,featured:$('#blogPostFeatured').checked,productIds:$$('[data-blog-product]:checked').map(i=>i.value),blocks:$$('[data-blog-block]').map(b=>({type:b.dataset.blogBlock,text:$('[data-block-text]',b)?.value || '',src:$('[data-block-src]',b)?.value.trim() || '',alt:$('[data-block-alt]',b)?.value || '',caption:$('[data-block-caption]',b)?.value || ''}))};
    return post;
  }
  function refreshList(){
    const settings=data(), statuses={draft:'Черновик',published:'Опубликовано',archived:'Архив'};
    $('#blogAdminList').innerHTML=settings.posts.length ? settings.posts.map(p=>`<div class="blog-admin-item"><h4>${e(p.title)}</h4><span>${statuses[p.status]} · ${e(p.category)}</span><div class="blog-block-actions"><button class="btn btn-light" type="button" data-blog-edit="${e(p.id)}">Редактировать</button>${p.status!=='archived'?`<button class="btn btn-light" type="button" data-blog-archive="${e(p.id)}">В архив</button>`:''}${p.status==='published'?`<a class="btn btn-light" href="${e(blog.href(p))}" target="_blank" rel="noopener">Открыть статью</a>`:''}</div></div>`).join('') : '<p>Статей пока нет. Создайте первую публикацию.</p>';
    $('#blogCategories').innerHTML=[...new Set(['Выбор добавок','Покупка и доставка','Новости BYVIT',...settings.posts.map(p=>p.category)])].map(c=>`<option value="${e(c)}"></option>`).join('');
  }
  async function save(event){
    event.preventDefault();const error=$('#blogPostError');error.textContent='';$('#blogPostSaved').textContent='';
    if(uploadBusy){error.textContent='Дождитесь завершения загрузки изображения.';return;}
    const post=readPost(), settings=data();
    if(settings.posts.some(p=>p.id===post.id && p.id!==originalId)){error.textContent='Этот адрес статьи уже занят.';return;}
    const next={...settings,posts:[...settings.posts.filter(p=>p.id!==originalId),post]};
    const invalid=blog.validate(next);if(invalid){error.textContent=invalid;return;}
    const button=$('#blogSaveButton');button.disabled=true;button.textContent='Сохраняем…';
    try{await api.persistBlog(next);populate(blog.normalize(next).posts.find(p=>p.id===post.id));refreshList();$('#blogPostSaved').textContent='Статья сохранена на сервере.';api.toast('Статья сохранена');}
    catch(err){error.textContent=err.message || 'Не удалось сохранить. Попробуйте ещё раз.';}
    finally{button.disabled=false;button.textContent='Сохранить статью';}
  }
  async function upload(input,target){
    const file=input.files?.[0];if(!file)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size>10*1024*1024){$('#blogPostError').textContent='Используйте JPG, PNG или WebP размером до 10 МБ.';input.value='';return;}
    uploadBusy+=1;input.disabled=true;
    try{target.value=await api.upload(file,{scope:'blog',maxEdge:1600});dirty=true;if(input.id==='blogCoverUpload')coverPreview();}
    catch(err){$('#blogPostError').textContent=err.message || 'Не удалось загрузить изображение.';}
    finally{uploadBusy-=1;input.disabled=false;input.value='';}
  }
  function preview(mode){
    const post=blog.normalize({posts:[readPost()]}).posts[0];if(!post){$('#blogPostError').textContent='Укажите заголовок и адрес для предпросмотра.';return;}
    const parent=$('#blogPreview');parent.hidden=false;parent.classList.toggle('is-mobile',mode==='mobile');
    const styles=['css/style.css','css/blog.css'].map(file=>`<link rel="stylesheet" href="${e(new URL(file,location.href).href)}">`).join('');
    $('#blogPreviewFrame').srcdoc=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}</head><body><main class="container article-shell"><article class="article-reading">${blog.article(post)}</article>${relatedProducts(post)}</main></body></html>`;
    if(!parent.open)parent.showModal();
  }
  async function exportBlog(button){
    button.disabled=true;
    try{
      const exported=blog.publicBlog(data());
      for(const post of exported.posts){
        const fields=[{item:post,key:'cover'},...post.blocks.filter(b=>b.type==='image').map(item=>({item,key:'src'}))];
        for(const {item,key} of fields){
          const url=new URL(item[key] || '.',location.href);
          if(url.origin!==location.origin || !url.pathname.startsWith('/uploads/'))continue;
          const response=await fetch(url);if(!response.ok)throw new Error('Не удалось включить загруженное изображение в экспорт.');
          const blob=await response.blob();
          item[key]=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Не удалось прочитать изображение.'));reader.readAsDataURL(blob);});
        }
      }
      const file=new Blob([JSON.stringify(exported,null,2)],{type:'application/json'}),url=URL.createObjectURL(file),link=document.createElement('a');link.href=url;link.download='byvit-blog-published.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);api.toast('Экспортированы только опубликованные статьи');
    }catch(error){api.toast(error.message);}finally{button.disabled=false;}
  }
  function renderAdmin(){
    const section=$('#admin-blog');if(!section)return;
    if(!api.isAdmin()){section.innerHTML='';return;}
    section.innerHTML=adminMarkup();
    $('#blogSettingsForm').insertAdjacentHTML('beforeend','<p class="admin-hint">На Node-сервере сохранённая публикация сразу доступна посетителям. Для GitHub Pages экспортируйте опубликованные статьи и пересоберите сайт. Загруженные изображения включаются в экспорт; черновики и архив — нет.</p><button type="button" class="btn btn-light" data-blog-export>Экспорт для GitHub Pages</button>');
    const settings=data();$('#blogHomeTitle').value=settings.homeTitle;$('#blogHomeDesktop').checked=settings.homeDesktop;$('#blogHomeMobile').checked=settings.homeMobile;refreshList();
    populate({category:'Выбор добавок',status:'draft',author:'Редакция BYVIT',authorType:'organization',publishedAt:today(),blocks:[{type:'paragraph',text:''}]});
    $('#blogPostForm').addEventListener('submit',save);
    $('#blogSettingsForm').addEventListener('submit',async event=>{event.preventDefault();const button=$('button[type="submit"]',event.target);button.disabled=true;try{await api.persistBlog({...data(),homeTitle:$('#blogHomeTitle').value,homeDesktop:$('#blogHomeDesktop').checked,homeMobile:$('#blogHomeMobile').checked});$('#blogSettingsStatus').textContent='Настройки сохранены.';}catch(err){$('#blogSettingsStatus').textContent=err.message;}finally{button.disabled=false;}});
    section.oninput=event=>{if(event.target.closest('#blogPostForm'))dirty=true;if(event.target.id==='blogPostTitle' && !originalId && !$('#blogPostId').dataset.manual)$('#blogPostId').value=blog.slug(event.target.value);if(event.target.id==='blogPostId')event.target.dataset.manual='1';if(event.target.id==='blogPostCover')coverPreview();if(event.target.id==='blogProductSearch'){$$('[data-blog-product-option]').forEach(label=>{label.hidden=!label.dataset.search.includes(event.target.value.toLowerCase());});}};
    section.onchange=event=>{if(event.target.closest('#blogPostForm'))dirty=true;if(event.target.matches('[data-blog-product]') && $$('[data-blog-product]:checked').length>4){event.target.checked=false;api.toast('Можно выбрать до четырёх товаров');}if(event.target.id==='blogCoverUpload')upload(event.target,$('#blogPostCover'));if(event.target.matches('[data-blog-block-upload]'))upload(event.target,$('[data-block-src]',event.target.closest('[data-blog-block]')));};
    // Keep a single delegated click handler even after an admin state refresh.
    section.onclick=async event=>{
      const button=event.target.closest('button');if(!button)return;
      if(button.hasAttribute('data-blog-preview-close')){$('#blogPreview').close();return;}
      if(button.hasAttribute('data-blog-export')){await exportBlog(button);return;}
      if(button.matches('[data-blog-new],[data-blog-edit]')){if(dirty && !confirm('Несохранённые изменения будут потеряны. Продолжить?'))return;const post=data().posts.find(p=>p.id===button.dataset.blogEdit);$('#blogPostId').removeAttribute('data-manual');populate(post || {category:'Выбор добавок',status:'draft',author:'Редакция BYVIT',publishedAt:today(),blocks:[{type:'paragraph',text:''}]});return;}
      if(button.dataset.blogArchive){if(!confirm('Перевести статью в архив? Её можно вернуть через редактор.'))return;button.disabled=true;try{const next=data();next.posts.find(p=>p.id===button.dataset.blogArchive).status='archived';await api.persistBlog(next);refreshList();if(originalId===button.dataset.blogArchive)populate(next.posts.find(p=>p.id===originalId));api.toast('Статья в архиве');}catch(err){api.toast(err.message);}finally{button.disabled=false;}return;}
      if(button.hasAttribute('data-blog-block-add')){if($$('[data-blog-block]').length>=100){api.toast('В статье уже 100 блоков');return;}$('#blogBlocks').insertAdjacentHTML('beforeend',blockMarkup({type:$('#blogBlockType').value}));dirty=true;syncBlockControls();return;}
      if(button.hasAttribute('data-blog-block-remove')){button.closest('[data-blog-block]').remove();dirty=true;syncBlockControls();return;}
      if(button.dataset.blogBlockMove){const block=button.closest('[data-blog-block]'),direction=Number(button.dataset.blogBlockMove);if(direction<0 && block.previousElementSibling)block.previousElementSibling.before(block);if(direction>0 && block.nextElementSibling)block.nextElementSibling.after(block);dirty=true;syncBlockControls();return;}
      if(button.dataset.blogPreview)preview(button.dataset.blogPreview);
    };
  }
  window.ByVitBlogUI={init(bridge){api=bridge;},render,renderAdmin};
})();
