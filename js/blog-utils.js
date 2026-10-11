// Shared, HTML-safe editorial model for browser, server and static publishing.
(function(root, factory){
  if(typeof module === 'object' && module.exports) module.exports = factory();
  else root.ByVitBlog = factory();
})(typeof window === 'object' ? window : globalThis, function(){
  'use strict';
  const text = (value, limit=20000) => typeof value === 'string' ? value.trim().slice(0,limit) : '';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const types = ['paragraph','heading','list','image','note'];
  function media(value){
    const src = text(value,2000000);
    if(/^https:\/\/[^\s<>"']+$/i.test(src)){try{const url=new URL(src);if(url.hostname && !url.username && !url.password)return src;}catch(error){}return '';}
    if(/^(?:\/?assets\/|\/uploads\/)[a-z0-9_./%?=&-]+$/i.test(src) && !src.includes('..')) return src;
    if(/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(src)) return src;
    return '';
  }
  function date(value){
    const candidate = text(value,10);
    return /^\d{4}-\d{2}-\d{2}$/.test(candidate) && !Number.isNaN(Date.parse(candidate)) && new Date(candidate).toISOString().slice(0,10) === candidate ? candidate : '';
  }
  function slug(value){
    const translit = {а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};
    return text(value,200).toLowerCase().split('').map(c=>translit[c] ?? c).join('').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100).replace(/-$/,'');
  }
  function normalize(value){
    const source = value && typeof value === 'object' ? value : {};
    const seen = new Set();
    const posts = (Array.isArray(source.posts) ? source.posts : []).slice(0,500).filter(p=>p && typeof p==='object').map(p=>{
      const id = slug(p.id || p.title);
      const blocks = (Array.isArray(p.blocks) ? p.blocks : []).slice(0,100).filter(b=>b && types.includes(b.type)).map(b=>({type:b.type,text:text(b.text),src:media(b.src),alt:text(b.alt,300),caption:text(b.caption,1000)}));
      return {id,title:text(p.title,200),excerpt:text(p.excerpt,600),category:text(p.category,80) || 'Выбор добавок',cover:media(p.cover),coverAlt:text(p.coverAlt,300),author:text(p.author,120) || 'Редакция BYVIT',authorType:p.authorType === 'person' ? 'person' : 'organization',authorRole:text(p.authorRole,160),publishedAt:date(p.publishedAt),updatedAt:date(p.updatedAt),status:['published','archived'].includes(p.status) ? p.status : 'draft',featured:p.featured === true,productIds:[...new Set((Array.isArray(p.productIds)?p.productIds:[]).map(String))].slice(0,4),seoTitle:text(p.seoTitle,200),seoDescription:text(p.seoDescription,600),blocks};
    }).filter(p=>{if(!p.id || seen.has(p.id))return false;seen.add(p.id);return true;});
    return {homeDesktop:source.homeDesktop !== false,homeMobile:source.homeMobile !== false,homeTitle:text(source.homeTitle,120) || 'Полезное о выборе и покупке',posts};
  }
  function validate(value){
    const posts = value?.posts;
    if(!Array.isArray(posts) || posts.length>500) return 'Список статей должен содержать не более 500 записей.';
    const ids = new Set();
    for(const p of posts){
      if(!p || typeof p!=='object' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.id || '') || p.id.length>100) return 'Адрес статьи: латинские буквы, цифры и дефисы, до 100 символов.';
      if(ids.has(p.id))return 'Адрес статьи уже занят.';
      ids.add(p.id);
      if(!text(p.title,200))return 'Укажите заголовок статьи.';
      if(!['draft','published','archived'].includes(p.status))return 'Некорректный статус статьи.';
      if(p.cover && !media(p.cover))return 'Обложка: используйте HTTPS-ссылку или загруженное изображение.';
      if(!Array.isArray(p.blocks) || p.blocks.length>100)return 'В статье должно быть не более 100 блоков.';
      if(p.blocks.some(b=>!b || !types.includes(b.type) || b.type==='image' && (b.src && !media(b.src) || p.status==='published' && (!media(b.src) || !text(b.alt,300)))))return 'Укажите корректное изображение и его описание.';
      if(p.status==='published' && (!date(p.publishedAt) || !text(p.excerpt,600) || !p.blocks.some(b=>b.type!=='image' && text(b.text))))return 'Для публикации нужны дата, краткое описание и текст статьи.';
    }
    return '';
  }
  function published(value){return normalize(value).posts.filter(p=>p.status==='published').sort((a,b)=>(b.publishedAt || '').localeCompare(a.publishedAt || '') || a.id.localeCompare(b.id));}
  function publicBlog(value){return {...normalize(value),posts:published(value)};}
  function href(post,staticMode=false){return staticMode ? `blog/${encodeURIComponent(post.id)}.html` : `article.html?id=${encodeURIComponent(post.id)}`;}
  function minutes(post){return Math.max(1,Math.ceil([post.excerpt,...post.blocks.map(b=>b.text)].join(' ').split(/\s+/).filter(Boolean).length/180));}
  function dateLabel(value){return value ? new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(value)) : '';}
  function card(post,staticMode=false){
    return `<a class="blog-card" href="${escape(href(post,staticMode))}"><div class="blog-card-cover">${post.cover ? `<img src="${escape(post.cover)}" alt="${escape(post.coverAlt || post.title)}" width="1200" height="600" loading="lazy" decoding="async">` : '<span class="blog-cover-fallback" aria-hidden="true">BYVIT / ЖУРНАЛ</span>'}</div><div class="blog-card-copy"><div class="blog-meta"><span>${escape(post.category)}</span><time datetime="${escape(post.publishedAt)}">${escape(dateLabel(post.publishedAt))}</time></div><h2>${escape(post.title)}</h2><p>${escape(post.excerpt)}</p><span class="blog-card-read">Читать · ${minutes(post)} мин <span aria-hidden="true">→</span></span></div></a>`;
  }
  function listing(value,{category='',page=1,staticMode=false}={}){
    const all = published(value), categories=[...new Set(all.map(p=>p.category))];
    const selected = categories.includes(category) ? category : '';
    const posts = selected ? all.filter(p=>p.category===selected) : all;
    const pages = Math.max(1,Math.ceil(posts.length/9)), current=Math.min(pages,Math.max(1,Math.floor(Number(page)||1)));
    const link = (topic,n=1)=>`blog.html${topic || n>1 ? '?'+new URLSearchParams({...topic ? {topic} : {},...n>1 ? {page:String(n)} : {}}) : ''}`;
    return `<nav class="blog-topics" aria-label="Темы блога"><a href="blog.html" ${!selected?'aria-current="page"':''}>Все статьи</a>${categories.map(topic=>`<a href="${escape(link(topic))}" ${selected===topic?'aria-current="page"':''}>${escape(topic)}</a>`).join('')}</nav><div class="blog-grid">${posts.length ? posts.slice((current-1)*9,current*9).map(p=>card(p,staticMode)).join('') : '<div class="empty-state"><h2>Статьи готовятся</h2><p>Скоро здесь появятся полезные материалы о выборе и покупке.</p><a class="btn btn-primary" href="catalog.html">Открыть каталог</a></div>'}</div>${pages>1 ? `<nav class="blog-pagination" aria-label="Страницы блога">${Array.from({length:pages},(_,i)=>`<a href="${escape(link(selected,i+1))}" ${i+1===current?'aria-current="page"':''}>${i+1}</a>`).join('')}</nav>` : ''}`;
  }
  function article(post){
    const headings=post.blocks.map((b,i)=>({b,i})).filter(({b})=>b.type==='heading');
    const paragraphs=value=>text(value).split(/\n\s*\n/).filter(Boolean).map(p=>`<p>${escape(p).replace(/\n/g,'<br>')}</p>`).join('');
    return `<header class="article-header"><div class="breadcrumbs"><a href="index.html">Главная</a> / <a href="blog.html">Блог</a> / ${escape(post.category)}</div><span class="eyebrow">${escape(post.category)}</span><h1>${escape(post.title)}</h1><p class="article-deck">${escape(post.excerpt)}</p><div class="article-byline"><span>${escape(post.author)}${post.authorRole ? ' · '+escape(post.authorRole) : ''}</span><span><time datetime="${escape(post.publishedAt)}">${escape(dateLabel(post.publishedAt))}</time> · ${minutes(post)} мин чтения</span>${post.updatedAt && post.updatedAt!==post.publishedAt ? `<span>Обновлено <time datetime="${escape(post.updatedAt)}">${escape(dateLabel(post.updatedAt))}</time></span>` : ''}</div></header>${post.cover ? `<figure class="article-cover"><img src="${escape(post.cover)}" alt="${escape(post.coverAlt || post.title)}" width="1200" height="600" decoding="async"></figure>` : ''}${headings.length ? `<details class="article-contents"><summary>Содержание <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary><nav aria-label="Содержание статьи">${headings.map(({b,i})=>`<a href="#section-${i}">${escape(b.text)}</a>`).join('')}</nav></details>` : ''}<div class="article-prose">${post.blocks.map((b,i)=>b.type==='heading' ? `<h2 id="section-${i}">${escape(b.text)}</h2>` : b.type==='list' ? `<ul>${b.text.split('\n').filter(s=>s.trim()).map(s=>`<li>${escape(s)}</li>`).join('')}</ul>` : b.type==='image' ? `<figure><img src="${escape(b.src)}" alt="${escape(b.alt)}" loading="lazy" decoding="async">${b.caption ? `<figcaption>${escape(b.caption)}</figcaption>` : ''}</figure>` : b.type==='note' ? `<aside class="article-note">${paragraphs(b.text)}</aside>` : paragraphs(b.text)).join('')}</div>`;
  }
  function schema(post,url,image){
    return {'@context':'https://schema.org','@type':'BlogPosting',headline:post.title,description:post.seoDescription || post.excerpt,datePublished:post.publishedAt,...post.updatedAt ? {dateModified:post.updatedAt} : {},author:{'@type':post.authorType==='person' ? 'Person' : 'Organization',name:post.author},publisher:{'@type':'Organization',name:'BYVIT'},mainEntityOfPage:url,url,...image ? {image} : {}};
  }
  return {types,escape,media,date,slug,normalize,validate,published,publicBlog,href,minutes,card,listing,article,schema};
});
