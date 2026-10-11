const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const brandUtils = require('../js/brand-utils');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const publicUrl = new URL(String(process.env.BYVIT_PUBLIC_URL || 'https://mihed1991.github.io/by_vit/').replace(/\/?$/, '/'));
const pages = [
  'index.html',
  'about.html',
  'brands.html',
  'brand.html',
  'cart.html',
  'catalog.html',
  'goals.html',
  'goal.html',
  'compare.html',
  'delivery.html',
  'faq.html',
  'product.html',
  'sale.html',
  'stores.html',
  'wishlist.html'
];
const assetManifest = {};

function fingerprintFile(relative, body=fs.readFileSync(path.join(root,relative))){
  const extension = path.extname(relative);
  const digest = crypto.createHash('sha256').update(body).digest('hex').slice(0,12);
  const versioned = `${relative.slice(0,-extension.length)}.${digest}${extension}`;
  fs.writeFileSync(path.join(output,versioned),body);
  assetManifest[relative] = versioned;
  return versioned;
}

function filesIn(directory){
  return fs.readdirSync(path.join(root,directory),{withFileTypes:true}).flatMap(entry => {
    const relative = `${directory}/${entry.name}`;
    return entry.isDirectory() ? filesIn(relative) : [relative];
  });
}

function versionReferences(source){
  // Local bundled media only; retain SVG fragments and leave external/upload/data URLs intact.
  return source.replace(/(?<![\w:/])((?:\.\.\/|\.\/)?assets\/[\w./-]+\.(?:png|jpe?g|webp|gif|svg|ico|mp4|webm|woff2?))(?:\?v=[\w.-]+)?/g, (full,reference) => {
    const prefix = reference.startsWith('../') ? '../' : reference.startsWith('./') ? './' : '';
    const key = reference.slice(prefix.length);
    return assetManifest[key] ? prefix + assetManifest[key] : full;
  });
}

function prepareResources(){
  filesIn('assets').forEach(file => fingerprintFile(file));
  for(const file of [...filesIn('css'),...filesIn('js')]){
    if(!/\.(?:css|js)$/.test(file)) continue;
    const compiled = versionReferences(fs.readFileSync(path.join(root,file),'utf8'));
    fs.writeFileSync(path.join(output,file),compiled);
    fingerprintFile(file,compiled);
  }
}

function copyDirectory(name) {
  fs.cpSync(path.join(root, name), path.join(output, name), { recursive: true });
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function pageMetadata(source, file) {
  const title = source.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() || 'ByVit';
  const description = source.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1]?.trim() || '';
  const pageUrl = new URL(file === 'index.html' ? './' : file, publicUrl).href;
  const imageUrl = new URL(assetManifest['assets/hero-share.jpg'] || 'assets/hero-share.jpg', publicUrl).href;
  return [
    `<link rel="canonical" href="${escapeHtml(pageUrl)}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(pageUrl)}">`,
    `<meta property="og:image" content="${escapeHtml(imageUrl)}">`,
    '<meta property="og:image:type" content="image/jpeg">',
    '<meta property="og:image:width" content="1600">',
    '<meta property="og:image:height" content="640">',
    '<meta property="og:image:alt" content="ByVit — спортивное питание и добавки">',
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:image" content="${escapeHtml(imageUrl)}">`,
    '<meta name="twitter:image:alt" content="ByVit — спортивное питание и добавки">'
  ].join('\n  ');
}

function prepareHtml(file) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const staticFlag = '<script>window.BYVIT_STATIC = true;</script>';
  const publicSource = source.replace(
    /<a\b[^>]*href=["']admin\.html["'][^>]*>[\s\S]*?<\/a>/gi,
    ''
  );
  const withStaticMode = publicSource.replace(
    /(\s*<script\s+src=["']js\/data\.js[^>]*><\/script>)/i,
    `\n  ${staticFlag}$1`
  );
  if (withStaticMode === publicSource) throw new Error(`Static mode was not injected into ${file}`);
  const html = withStaticMode.replace(/\s*<\/head>/i, `\n  ${pageMetadata(withStaticMode, file)}\n</head>`);
  const versioned = versionReferences(html).replace(/((?:css|js)\/[\w./-]+\.(?:css|js))(?:\?v=[\w.-]+)?/g, (full,reference) => assetManifest[reference] || full);
  fs.writeFileSync(path.join(output, file), versioned);
}

function defaultProducts() {
  const code = fs.readFileSync(path.join(root, 'js', 'data.js'), 'utf8');
  const sandbox = { window: {}, encodeURIComponent };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'js/data.js' });
  return sandbox.window.ByVitDefaults?.products || [];
}

function defaultBrandData(){
  const sandbox = {window:{},encodeURIComponent};
  vm.runInNewContext(fs.readFileSync(path.join(root,'js/data.js'),'utf8'),sandbox);
  const defaults = sandbox.window.ByVitDefaults;
  return {site:defaults.site,brands:brandUtils.list(defaults.products,defaults.site)};
}

function writeBrandPages(){
  const {site,brands} = defaultBrandData();
  const template = fs.readFileSync(path.join(output,'brand.html'),'utf8');
  fs.mkdirSync(path.join(output,'brands'),{recursive:true});
  for(const brand of brands){
    const relative = `brands/${encodeURIComponent(brand.id)}.html`;
    const url = new URL(relative,publicUrl).href;
    const logo = site.brandImages?.[brand.name];
    let html = template.replace('<head>','<head>\n  <base href="../">')
      .replace('window.BYVIT_STATIC = true;',`window.BYVIT_STATIC = true; window.BYVIT_BRAND_ID = ${JSON.stringify(brand.id).replace(/</g,'\\u003c')};`)
      .replace(/<title>[\s\S]*?<\/title>/,()=>`<title>${escapeHtml(brand.seoTitle)}</title>`)
      .replace(/<meta\s+name="description"\s+content="[^"]*"\s*>/,()=>`<meta name="description" content="${escapeHtml(brand.seoDescription)}">`)
      .replace(/<link rel="canonical" href="[^"]*">/,()=>`<link rel="canonical" href="${escapeHtml(url)}">`)
      .replace(/<meta property="og:title" content="[^"]*">/,()=>`<meta property="og:title" content="${escapeHtml(brand.seoTitle)}">`)
      .replace(/<meta property="og:description" content="[^"]*">/,()=>`<meta property="og:description" content="${escapeHtml(brand.seoDescription)}">`)
      .replace(/<meta property="og:url" content="[^"]*">/,()=>`<meta property="og:url" content="${escapeHtml(url)}">`)
      .replace('</head>',()=>`<meta name="twitter:title" content="${escapeHtml(brand.seoTitle)}"><meta name="twitter:description" content="${escapeHtml(brand.seoDescription)}"><script id="seo-brand" type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'CollectionPage',name:brand.heading,url,description:brand.seoDescription,about:{'@type':'Brand',name:brand.name}}).replace(/</g,'\\u003c')}</script></head>`)
      .replace(/<!-- BRAND_HERO_START -->[\s\S]*?<!-- BRAND_HERO_END -->/,()=>`<!-- BRAND_HERO_START -->${brandUtils.hero(brand,logo)}<!-- BRAND_HERO_END -->`);
    html = versionReferences(html);
    // URI-encode links, but retain Unicode filesystem names as requested by HTTP decoding.
    fs.writeFileSync(path.join(output,'brands',`${brand.id}.html`),html);
  }
}

function writeSeoFiles() {
  const sitemapUrl = new URL('sitemap.xml', publicUrl).href;
  const robots = `User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /cart.html\nDisallow: /wishlist.html\nDisallow: /compare.html\nSitemap: ${sitemapUrl}\n`;
  fs.writeFileSync(path.join(output, 'robots.txt'), robots);

  const indexablePages = ['index.html', 'catalog.html', 'goals.html', 'brands.html', 'sale.html', 'delivery.html', 'stores.html', 'about.html', 'faq.html'];
  const paths = indexablePages.map(file => file === 'index.html' ? './' : file);
  defaultProducts().forEach(product => paths.push(`product.html?id=${encodeURIComponent(product.id)}`));
  defaultBrandData().brands.forEach(brand => paths.push(`brands/${encodeURIComponent(brand.id)}.html`));
  const urls = paths.map(value => `  <url><loc>${escapeHtml(new URL(value, publicUrl).href)}</loc></url>`).join('\n');
  fs.writeFileSync(path.join(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

['assets', 'css', 'js'].forEach(copyDirectory);
prepareResources();
pages.forEach(prepareHtml);
writeBrandPages();
writeSeoFiles();

fs.writeFileSync(path.join(output, '.nojekyll'), '');
fs.writeFileSync(path.join(output, 'asset-manifest.json'), JSON.stringify(assetManifest,null,2));
fs.writeFileSync(path.join(output, '404.html'), fs.readFileSync(path.join(output, 'index.html')));

console.log(`Static storefront built in ${output}`);
console.log(`Published pages: ${pages.length}; admin and server files excluded; public URL: ${publicUrl.href}`);
