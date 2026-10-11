// Shared brand identities and metadata for the browser, Node server and static build.
(function(root, factory){
  if(typeof module === 'object' && module.exports) module.exports = factory();
  else root.ByVitBrands = factory();
})(typeof window === 'object' ? window : globalThis, function(){
  const fields = ['heading','summary','description','seoTitle','seoDescription'];
  const text = value => typeof value === 'string' ? value.trim() : '';
  function normalizeProfiles(value){
    return Object.fromEntries(Object.entries(value || {}).filter(([name,profile]) => text(name) && profile && typeof profile === 'object').map(([name,profile]) => [text(name),Object.fromEntries(fields.map(field => [field,text(profile[field])]))]));
  }
  function slug(name){
    return name.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'') || 'brand';
  }
  function hash(name){
    let result = 2166136261;
    for(const character of name) result = Math.imul(result ^ character.codePointAt(0),16777619);
    return (result >>> 0).toString(36);
  }
  function list(products, site={}){
    const profiles = normalizeProfiles(site.brandProfiles);
    const names = [...new Set([...(products || []).map(product => text(product.brand)),...Object.keys(profiles)].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));
    return names.map(name => {
      const base = slug(name);
      const id = names.filter(other => slug(other) === base).length > 1 ? `${base}-${hash(name)}` : base;
      const profile = Object.hasOwn(profiles,name) ? profiles[name] : {};
      return {name,id,...profile,heading:profile.heading || name,summary:profile.summary || `Товары ${name} в BYVIT. Выберите подходящую фасовку и оформите заказ с доставкой по Беларуси.`,seoTitle:profile.seoTitle || `${name} — купить с доставкой по Беларуси | BYVIT`,seoDescription:profile.seoDescription || profile.summary || `Товары ${name} в магазине BYVIT: цены, наличие и доставка по Беларуси.`};
    });
  }
  const escape = value => String(value || '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  function hero(brand, image){
    const src = typeof image === 'string' ? image : image?.src;
    return `<div class="breadcrumbs"><a href="index.html">Главная</a> / <a href="brands.html">Бренды</a> / ${escape(brand.name)}</div>
      <div class="brand-page-heading"><div class="brand-page-copy"><h1>${escape(brand.heading)}</h1><p class="brand-page-summary">${escape(brand.summary)}</p></div>
      ${src ? `<div class="brand-page-logo"><img src="${escape(src)}" alt="${escape(brand.name)}" width="180" height="96" decoding="async"></div>` : ''}</div>
      ${brand.description ? `<details class="brand-page-description"><summary><span class="brand-description-expand">Подробнее о бренде</span><span class="brand-description-collapse">Свернуть описание</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary><div>${brand.description.split(/\n\s*\n/).map(text=>`<p>${escape(text)}</p>`).join('')}</div></details>` : ''}`;
  }
  return {fields,normalizeProfiles,list,hero};
});
