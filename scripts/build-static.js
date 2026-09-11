const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const publicUrl = new URL(String(process.env.BYVIT_PUBLIC_URL || 'https://mihed1991.github.io/by_vit/').replace(/\/?$/, '/'));
const pages = [
  'index.html',
  'about.html',
  'brands.html',
  'cart.html',
  'catalog.html',
  'compare.html',
  'delivery.html',
  'faq.html',
  'product.html',
  'sale.html',
  'stores.html',
  'wishlist.html'
];

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
  const imageUrl = new URL('assets/product-whey.jpg', publicUrl).href;
  return [
    `<link rel="canonical" href="${escapeHtml(pageUrl)}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(pageUrl)}">`,
    `<meta property="og:image" content="${escapeHtml(imageUrl)}">`,
    '<meta name="twitter:card" content="summary_large_image">'
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
  fs.writeFileSync(path.join(output, file), html);
}

function defaultProducts() {
  const code = fs.readFileSync(path.join(root, 'js', 'data.js'), 'utf8');
  const sandbox = { window: {}, encodeURIComponent };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'js/data.js' });
  return sandbox.window.ByVitDefaults?.products || [];
}

function writeSeoFiles() {
  const sitemapUrl = new URL('sitemap.xml', publicUrl).href;
  const robots = `User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /cart.html\nDisallow: /wishlist.html\nDisallow: /compare.html\nSitemap: ${sitemapUrl}\n`;
  fs.writeFileSync(path.join(output, 'robots.txt'), robots);

  const indexablePages = ['index.html', 'catalog.html', 'brands.html', 'sale.html', 'delivery.html', 'stores.html', 'about.html', 'faq.html'];
  const paths = indexablePages.map(file => file === 'index.html' ? './' : file);
  defaultProducts().forEach(product => paths.push(`product.html?id=${encodeURIComponent(product.id)}`));
  const urls = paths.map(value => `  <url><loc>${escapeHtml(new URL(value, publicUrl).href)}</loc></url>`).join('\n');
  fs.writeFileSync(path.join(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

['assets', 'css', 'js'].forEach(copyDirectory);
pages.forEach(prepareHtml);
writeSeoFiles();

fs.writeFileSync(path.join(output, '.nojekyll'), '');
fs.writeFileSync(path.join(output, '404.html'), fs.readFileSync(path.join(output, 'index.html')));

console.log(`Static storefront built in ${output}`);
console.log(`Published pages: ${pages.length}; admin and server files excluded; public URL: ${publicUrl.href}`);
