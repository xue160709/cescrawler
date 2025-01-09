const { chromium } = require('playwright');
const fs = require('fs');

interface AwardItem {
  name: string;
  company: string;
  category: string;
  year: number;
  url: string;
  description?: string;  // 添加可选的描述字段
}

// 提取页面数据的函数
async function extractPageData(): Promise<AwardItem[]> {
  const baseUrl = 'https://www.ces.tech';
  const links = document.querySelectorAll('div.container a.absolute.inset-0');
  
  return Array.from(links).map(link => {
    const href = link.getAttribute('href') || '';
    const title = link.getAttribute('aria-label') || '';
    
    // 只获取2025年的奖项链接
    if (!href.includes('/ces-innovation-awards/2025/')) {
      return null;
    }
    
    // 获取其他信息
    const listItem = link.closest('li');
    const category = listItem?.querySelector('.relative.flex.flex-wrap a span')?.textContent?.trim() || '';
    const description = listItem?.querySelector('.mt-4.f-body-3')?.textContent?.trim() || '';
    
    return {
      name: title,
      company: title,
      category: category.split('\n')[0],
      year: 2025,
      url: baseUrl + href,
      description
    };
  }).filter(item => item !== null) as AwardItem[];
}

async function scrapeCESAwards() {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-web-security']
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  const awards: AwardItem[] = [];
  
  try {
    await page.setDefaultTimeout(30000);
    
    console.log('正在访问页面...');
    await page.goto('https://www.ces.tech/ces-innovation-awards/?page=1', {
      waitUntil: 'networkidle'
    });
    
    console.log('等待页面元素加载...');
    await page.waitForSelector('div.container', { 
      state: 'visible', 
      timeout: 30000 
    });
    
    // 获取总页数
    const totalPages = await page.evaluate(() => {
      const pageNumbers = document.querySelectorAll('.pagination li');
      return parseInt(pageNumbers[pageNumbers.length - 2]?.textContent || '1');
    });
    
    console.log(`总页数: ${totalPages}`);
    
    // 遍历每一页
    for (let currentPage = 1; currentPage <= totalPages; currentPage++) {
      console.log(`正在爬取第 ${currentPage} 页`);
      
      if (currentPage > 1) {
        await page.goto(`https://www.ces.tech/ces-innovation-awards/?page=${currentPage}`, {
          waitUntil: 'networkidle'
        });
        await page.waitForSelector('.grid li');
      }
      
      // 提取当前页面的奖项信息
      const pageAwards = await page.evaluate(extractPageData);
      
      awards.push(...pageAwards);
      
      // 输出当前页面获取的URL
      pageAwards.forEach((award: AwardItem) => {
        console.log('标题:', award.name);
        console.log('URL:', award.url);
        console.log('描述:', award.description);
        console.log('-------------------');
      });
      
      // 添加随机延迟，避免请求过快
      await page.waitForTimeout(1000 + Math.random() * 2000);
    }
    
    fs.writeFileSync('ces_awards_2025.json', JSON.stringify(awards, null, 2));
    console.log(`成功爬取 ${awards.length} 个奖项`);
    
  } catch (error) {
    console.error('爬取过程中出错:', error);
    // 保存已爬取的数据
    if (awards.length > 0) {
      fs.writeFileSync('ces_awards_2025_partial.json', JSON.stringify(awards, null, 2));
      console.log(`已保存部分数据: ${awards.length} 个奖项`);
    }
  } finally {
    await browser.close();
  }
}

// 运行爬虫
scrapeCESAwards().catch(console.error);