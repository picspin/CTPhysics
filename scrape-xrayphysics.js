// 脚本用于爬取xrayphysics.com网站的CT重建相关内容
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { promisify } = require('util');

// 创建目录（如果不存在）
const mkdirAsync = promisify(fs.mkdir);
const existsAsync = promisify(fs.exists);

// 下载文件的函数
async function downloadFile(url, outputPath) {
  // 确保目录存在
  const dir = path.dirname(outputPath);
  if (!(await existsAsync(dir))) {
    await mkdirAsync(dir, { recursive: true });
  }
  
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`下载失败，状态码: ${response.statusCode}`));
        return;
      }
      
      const fileStream = fs.createWriteStream(outputPath);
      response.pipe(fileStream);
      
      fileStream.on('finish', () => {
        fileStream.close();
        console.log(`已下载: ${url} -> ${outputPath}`);
        resolve();
      });
      
      fileStream.on('error', (err) => {
        fs.unlink(outputPath, () => {}); // 删除不完整的文件
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// 爬取单个页面的函数
async function scrapePage(browser, url) {
  const context = await browser.newContext();
  const page = await context.newPage();

  // 访问目标网站页面
  await page.goto(url);
  console.log(`已加载页面: ${url}`);

  // 等待页面加载完成
  await page.waitForLoadState('networkidle');

  // 获取页面标题和描述
  const title = await page.title();
  console.log(`页面标题: ${title}`);

  // 获取页面内容结构
  const sections = await page.$$eval('h2, h3', (headers) => {
    return headers.map(header => ({
      level: header.tagName.toLowerCase(),
      title: header.textContent,
      id: header.id || ''
    }));
  });

  console.log('页面章节结构:');
  console.log(JSON.stringify(sections, null, 2));

  // 查找交互式元素
  const interactiveElements = await page.$$eval('canvas, svg, [id*=\'simulator\'], [class*=\'simulator\']', 
    elements => elements.map(el => ({
      tagName: el.tagName,
      id: el.id || '',
      className: el.className || '',
      width: el.offsetWidth,
      height: el.offsetHeight
    }))
  );

  console.log('交互式元素:');
  console.log(JSON.stringify(interactiveElements, null, 2));

  // 获取所有图片资源
  const images = await page.$$eval('img', imgs => 
    imgs.map(img => ({
      src: img.src,
      alt: img.alt || '',
      width: img.width,
      height: img.height
    }))
  );

  console.log('图片资源:');
  console.log(JSON.stringify(images, null, 2));
  
  // 下载图片资源
  console.log('\n开始下载图片资源...');
  const imagesDir = path.join(__dirname, 'public', 'images');
  
  // 确保图片目录存在
  if (!(await existsAsync(imagesDir))) {
    await mkdirAsync(imagesDir, { recursive: true });
  }
  
  // 下载所有图片
  for (const img of images) {
    try {
      if (!img.src || !img.src.startsWith('http')) continue;
      
      const filename = img.src.split('/').pop();
      const outputPath = path.join(imagesDir, filename);
      
      await downloadFile(img.src, outputPath);
    } catch (err) {
      console.error(`下载图片失败: ${img.src}`, err);
    }
  }

  // 获取所有脚本资源
  const scripts = await page.$$eval('script[src]', scripts => 
    scripts.map(script => ({
      src: script.src
    }))
  );

  console.log('脚本资源:');
  console.log(JSON.stringify(scripts, null, 2));
  
  // 下载JavaScript资源
  console.log('\n开始下载JavaScript资源...');
  const scriptsDir = path.join(__dirname, 'public', 'scripts');
  
  // 确保脚本目录存在
  if (!(await existsAsync(scriptsDir))) {
    await mkdirAsync(scriptsDir, { recursive: true });
  }
  
  // 下载所有脚本
  for (const script of scripts) {
    try {
      if (!script.src || !script.src.startsWith('http')) continue;
      
      const filename = script.src.split('/').pop();
      const outputPath = path.join(scriptsDir, filename);
      
      await downloadFile(script.src, outputPath);
    } catch (err) {
      console.error(`下载脚本失败: ${script.src}`, err);
    }
  }

  // 获取交互式元素的源代码
  console.log('\n获取交互式元素的源代码...');
  for (const element of interactiveElements) {
    if (element.id) {
      try {
        // 获取元素的HTML和相关JavaScript
        const elementHtml = await page.$eval(`#${element.id}`, el => el.outerHTML);
        console.log(`元素 #${element.id} 的HTML:`);
        console.log(elementHtml.substring(0, 200) + '...');
        
        // 尝试获取与该元素相关的JavaScript代码
        const relatedScripts = await page.evaluate((elementId) => {
          // 查找所有可能与该元素相关的内联脚本
          const scripts = Array.from(document.querySelectorAll('script:not([src])'));
          return scripts
            .map(script => script.textContent)
            .filter(content => content.includes(elementId));
        }, element.id);
        
        if (relatedScripts.length > 0) {
          console.log(`找到与元素 #${element.id} 相关的内联脚本:`);
          
          // 保存相关脚本
          const scriptOutputPath = path.join(scriptsDir, `${element.id}.js`);
          fs.writeFileSync(scriptOutputPath, relatedScripts.join('\n\n'));
          console.log(`已保存相关脚本到: ${scriptOutputPath}`);
        }
      } catch (err) {
        console.error(`获取元素 #${element.id} 信息时出错:`, err);
      }
    }
  }
  
  // 保存页面HTML
  const htmlContent = await page.content();
  const pageName = url.split('/').pop();
  const htmlOutputPath = path.join(__dirname, 'public', pageName);
  fs.writeFileSync(htmlOutputPath, htmlContent);
  console.log(`已保存页面HTML到: ${htmlOutputPath}`);
  
  await context.close();
  return { title, interactiveElements };
}

(async () => {
  // 启动浏览器
  const browser = await chromium.launch({ headless: false });
  
  // 要爬取的页面列表
  const pagesToScrape = [
    'https://www.xrayphysics.com/ct.html',
    'https://www.xrayphysics.com/reconstruction.html'
  ];
  
  // 依次爬取每个页面
  for (const pageUrl of pagesToScrape) {
    console.log(`\n开始爬取页面: ${pageUrl}`);
    await scrapePage(browser, pageUrl);
    console.log(`完成爬取页面: ${pageUrl}`);
  }
  
  console.log('\n爬取完成！所有资源已下载到public目录');
  await browser.close();
})().catch(err => {
  console.error('爬取过程中出错:', err);
  process.exit(1);
});