// Rasterize the supplied artwork unchanged; no font substitution or redrawing.
const fs = require('fs');
const path = require('path');
const {chromium} = require('playwright-core');
const root = path.resolve(__dirname, '..');

async function main(){
  const executablePath = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find(file => fs.existsSync(file));
  if(!executablePath) throw new Error('Chrome/Chromium is required to rasterize the supplied favicon.');
  const browser = await chromium.launch({executablePath, headless:true});
  try{
    const page = await browser.newPage();
    const source = `data:image/svg+xml;base64,${fs.readFileSync(path.join(root,'assets/favicon.svg')).toString('base64')}`;
    for(const [size, file] of [[48,'favicon-48.png'], [180,'apple-touch-icon.png']]){
      const data = await page.evaluate(async ({source,size}) => {
        const image = new Image();
        image.src = source;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        canvas.getContext('2d').drawImage(image,0,0,size,size);
        return canvas.toDataURL('image/png').split(',')[1];
      }, {source,size});
      fs.writeFileSync(path.join(root,'assets',file),Buffer.from(data,'base64'));
      console.log(`Generated ${file}: ${size}×${size}`);
    }
  }finally{ await browser.close(); }
}
main().catch(error => {console.error(error); process.exitCode = 1;});
