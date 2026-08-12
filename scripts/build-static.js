const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
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

function copyDirectory(name){
  fs.cpSync(path.join(root, name), path.join(output, name), {recursive:true});
}

function prepareHtml(file){
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const staticFlag = '<script>window.BYVIT_STATIC = true;</script>';
  const publicSource = source.replace(
    /<a\b[^>]*href=["']admin\.html["'][^>]*>[\s\S]*?<\/a>/gi,
    ''
  );
  const html = publicSource.replace(
    /(\s*<script\s+src=["']js\/data\.js[^>]*><\/script>)/i,
    `\n  ${staticFlag}$1`
  );
  if(html === publicSource) throw new Error(`Static mode was not injected into ${file}`);
  fs.writeFileSync(path.join(output, file), html);
}

fs.rmSync(output, {recursive:true, force:true});
fs.mkdirSync(output, {recursive:true});

['assets', 'css', 'js'].forEach(copyDirectory);
pages.forEach(prepareHtml);

fs.writeFileSync(path.join(output, '.nojekyll'), '');
fs.writeFileSync(path.join(output, '404.html'), fs.readFileSync(path.join(output, 'index.html')));

console.log(`Static storefront built in ${output}`);
console.log(`Published pages: ${pages.length}; admin and server files excluded.`);
