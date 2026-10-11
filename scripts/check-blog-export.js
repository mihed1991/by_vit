// Validate a portable blog export through the real static publisher, restoring dist afterward.
const assert=require('assert/strict');
const fs=require('fs');
const os=require('os');
const path=require('path');
const {execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'byvit-blog-export-'));
const post={id:'portable-post',title:'Portable article',excerpt:'Portable excerpt',category:'Проверка',author:'Редакция BYVIT',authorType:'organization',publishedAt:'2026-10-11',status:'published',cover:'data:image/png;base64,'+fs.readFileSync(path.join(root,'assets/favicon-96.png')).toString('base64'),coverAlt:'Test image',blocks:[{type:'heading',text:'Portable section'},{type:'paragraph',text:'Portable article body'}]};
const file=path.join(temp,'blog.json');
const build=env=>execFileSync(process.execPath,['scripts/build-static.js'],{cwd:root,env:{...process.env,BYVIT_STATIC_BLOG_FILE:'',...env},stdio:'pipe'});
try{
  fs.writeFileSync(file,JSON.stringify({posts:[post,{...post,id:'private-export-draft',title:'PRIVATE_EXPORT_DRAFT_432',status:'draft'},{...post,id:'private-export-archive',title:'PRIVATE_EXPORT_ARCHIVE_432',status:'archived'}]}));
  build({BYVIT_STATIC_BLOG_FILE:file});
  const manifest=JSON.parse(fs.readFileSync(path.join(dist,'asset-manifest.json')));
  const data=fs.readFileSync(path.join(dist,manifest['js/data.js']),'utf8');
  assert.ok(data.includes('Portable article') && !data.includes('PRIVATE_EXPORT_'),'Only published posts may be bundled');
  assert.ok(!data.includes('data:image/png;base64'),'Portable images must become real hashed assets');
  assert.ok(!fs.existsSync(path.join(dist,'blog/private-export-draft.html')));
  assert.ok(!fs.existsSync(path.join(dist,'blog/private-export-archive.html')));
  const html=fs.readFileSync(path.join(dist,'blog/portable-post.html'),'utf8');
  assert.ok(html.includes('Portable article body') && html.includes('"@type":"BlogPosting"'));
  assert.match(html,/content="index, follow, max-image-preview:large"/);
  const image=Object.entries(manifest).find(([name])=>name.startsWith('assets/blog-image-'));
  assert.ok(image && fs.existsSync(path.join(dist,image[1])));
  assert.ok(html.includes(image[1]));
  const sitemap=fs.readFileSync(path.join(dist,'sitemap.xml'),'utf8');
  assert.ok(sitemap.includes('blog/portable-post.html') && !sitemap.includes('private-export-'));
  console.log('Portable blog export: published-only HTML/JS/sitemap, inline image extraction and hashed assets passed.');
}finally{
  build({BYVIT_STATIC_BLOG_FILE:''});
  fs.rmSync(temp,{recursive:true,force:true});
}
