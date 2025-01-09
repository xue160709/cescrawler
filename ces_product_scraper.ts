import { chromium } from 'playwright';
import * as fs from 'fs';

interface ProductDetail {
  name?: string;
  image?: {
    src: string;
    alt: string;
  };
  company?: string;
  honor?: string;
  categories?: string[];
  description?: string;
  url: string;
}

async function extractProductData(page: any): Promise<ProductDetail> {
  return await page.evaluate(() => {
    const product: ProductDetail = {
      url: window.location.href
    };

    // 获取产品名字
    const productName = document.querySelector('h1.outline-none.mt-24.f-display-3.text-secondary')?.textContent?.trim();
    if(productName) {
      product.name = productName;
    }

    // 获取图片
    const img = document.querySelector('header div.flex.justify-center.items-center.h-full.aspect-3\\/2 img');
    if(img) {
      product.image = {
        src: (img as HTMLImageElement).src,
        alt: (img as HTMLImageElement).alt
      };
    }

    // 获取公司名字
    const companyName = document.querySelector('span.f-body-2.font-medium')?.textContent;
    if(companyName) {
      product.company = companyName;
    }

    // 获取荣誉信息
    const honor = document.querySelector('ul.mt-8.first\\:mt-0.f-body-2 li')?.textContent;
    if(honor) {
      // 去掉多余的换行和空格，只保留实际内容
      const cleanHonor = honor.trim().replace(/\s+/g, ' ');
      product.honor = cleanHonor
    }

    // 获取分类
    const categories = document.querySelector('ul.relative.flex.xl\\:flex-col.flex-wrap.items-start.justify-start.gap-y-8.gap-x-4.mt-24.first\\:mt-0');
    if(categories) {
      const categoryLinks = categories.querySelectorAll('a');
      product.categories = Array.from(categoryLinks)
        .map(link => link.textContent?.split('移动设备')[0].trim())
        .filter((category): category is string => category !== undefined && category !== '');
    }

    // 获取产品描述
    const description = document.querySelector('div.rich-text p')?.textContent;
    if(description) {
      product.description = description.split('10kM 是')[0].trim();
    }

    return product;
  });
}

async function scrapeProductDetails() {
  const awardsData = JSON.parse(fs.readFileSync('ces_awards_2025.json', 'utf8'));
  const urls = awardsData.map((item: any) => item.url);

  const browser = await chromium.launch({
    headless: false
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });

  const products: ProductDetail[] = [];
  const CONCURRENT_PAGES = 10; // 并发数量
  
  try {
    // 将URL列表分成多个批次
    for (let i = 0; i < urls.length; i += CONCURRENT_PAGES) {
      const urlBatch = urls.slice(i, i + CONCURRENT_PAGES);
      console.log(`正在处理第 ${i + 1} 到 ${i + urlBatch.length} 个产品`);

      const pageTasks = await Promise.all(
        urlBatch.map(async (url: string) => {
          const page = await context.newPage();
          try {
            await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
            await page.waitForSelector('h1.outline-none.mt-24.f-display-3.text-secondary', { timeout: 10000 });
            
            const productData = await extractProductData(page);
            await page.close();
            return { success: true, data: productData };
          } catch (error) {
            console.error(`爬取产品失败: ${url}`, error);
            fs.appendFileSync('failed_urls.txt', url + '\n');
            await page.close();
            return { success: false, url };
          }
        })
      );

      // 处理每批次的结果
      const successfulProducts = pageTasks
        .filter((result): result is { success: true; data: ProductDetail } => 
          result.success && 'data' in result
        )
        .map(result => result.data);
      
      products.push(...successfulProducts);

      // 每批次完成后保存数据
      fs.writeFileSync('ces_products_partial.json', JSON.stringify(products, null, 2));
      console.log(`已保存${products.length}个产品数据到临时文件`);

      // 添加短暂延迟，避免请求过于密集
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 保存所有数据
    fs.writeFileSync('ces_products.json', JSON.stringify(products, null, 2));
    console.log(`成功爬取 ${products.length} 个产品详情`);

  } catch (error) {
    console.error('爬取过程中出错:', error);
    // 保存已爬取的数据
    if (products.length > 0) {
      fs.writeFileSync('ces_products_partial.json', JSON.stringify(products, null, 2));
      console.log(`已保存部分数据: ${products.length} 个产品`);
    }
  } finally {
    await browser.close();
  }
}

// 运行爬虫
scrapeProductDetails().catch(console.error); 