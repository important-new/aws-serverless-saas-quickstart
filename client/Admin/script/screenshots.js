const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// 登录凭据配置
const LOGIN_CONFIG = {
  username: 'admin',
  password: process.env.ADMIN_PASSWORD || 'CHANGE_ME'
};

// 检查应用是否运行
async function checkAppRunning() {
  try {
    const http = require('http');
    
    return new Promise((resolve) => {
      const req = http.get('http://localhost:4200', (res) => {
        resolve(res.statusCode === 200);
      });
      
      req.on('error', () => {
        resolve(false);
      });
      
      req.setTimeout(5000, () => {
        req.destroy();
        resolve(false);
      });
    });
  } catch (error) {
    return false;
  }
}

async function loginWithAmplifyAPI(page) {
  console.log('使用 Amplify Auth API 进行认证...');
  
  try {
    // 等待页面加载
    await page.waitForSelector('app-root', { timeout: 10000 });
    
    // 通过浏览器控制台执行 Amplify 认证
    const authResult = await page.evaluate(async (credentials) => {
      try {
        // 检查 Amplify 是否可用
        if (typeof window.Amplify === 'undefined') {
          throw new Error('Amplify 未加载');
        }
        
        // 直接调用 Amplify Auth 进行认证
        const { Auth } = window.Amplify;
        
        // 尝试登录
        const user = await Auth.signIn(credentials.username, credentials.password);
        console.log('Amplify 认证成功:', user);
        
        return { success: true, user };
      } catch (error) {
        console.error('Amplify 认证失败:', error);
        return { success: false, error: error.message };
      }
    }, LOGIN_CONFIG);
    
    if (authResult.success) {
      console.log('✅ Amplify API 认证成功！');
      
      // 等待页面刷新或重定向
      await page.waitForTimeout(3000);
      
      // 检查是否已登录
      const isLoggedIn = await page.evaluate(() => {
        const authElement = document.querySelector('amplify-authenticator');
        return !authElement || authElement.style.display === 'none';
      });
      
      if (isLoggedIn) {
        console.log('✅ 登录状态确认成功！');
        return true;
      } else {
        console.log('⚠️ 认证成功但页面状态未更新，尝试刷新...');
        await page.reload();
        await page.waitForTimeout(3000);
        return true;
      }
    } else {
      console.error('❌ Amplify API 认证失败:', authResult.error);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Amplify API 认证过程中出错:', error.message);
    return false;
  }
}

// 备用方法：如果 API 认证失败，回退到 UI 操作
async function fallbackLogin(page) {
  console.log('回退到 UI 操作登录...');
  
  try {
    // 等待登录表单加载
    await page.waitForSelector('amplify-authenticator', { timeout: 10000 });
    console.log('找到登录表单');
    
    // 输入用户名
    await page.type('input[name="username"], input[type="email"], input[placeholder*="用户名"], input[placeholder*="Username"]', LOGIN_CONFIG.username);
    console.log('用户名输入完成');
    
    // 输入密码
    await page.type('input[name="password"], input[type="password"]', LOGIN_CONFIG.password);
    console.log('密码输入完成');
    
    // 点击登录按钮
    await page.click('button[type="submit"], button:contains("登录"), button:contains("Login"), button:contains("Sign In")');
    console.log('点击登录按钮');
    
    // 等待可能的邮箱认证页面
    await page.waitForTimeout(3000);
    
    // 处理邮箱认证跳过
    await handleEmailVerification(page);
    
    // 等待登录完成
    await page.waitForFunction(() => {
      const authElement = document.querySelector('amplify-authenticator');
      return !authElement || authElement.style.display === 'none';
    }, { timeout: 30000 });
    
    console.log('✅ UI 登录成功！');
    return true;
    
  } catch (error) {
    console.error('❌ UI 登录失败:', error.message);
    return false;
  }
}

async function handleEmailVerification(page) {
  console.log('检查是否需要邮箱认证...');
  
  try {
    // 查找跳过验证按钮
    const skipSelectors = [
      'button:contains("跳过")',
      'button:contains("Skip")',
      'button:contains("跳过验证")',
      'a:contains("跳过")',
      'a:contains("Skip")'
    ];
    
    for (const selector of skipSelectors) {
      try {
        const skipButton = await page.$(selector);
        if (skipButton) {
          console.log(`找到跳过验证元素: ${selector}`);
          await skipButton.click();
          console.log('已点击跳过验证按钮');
          await page.waitForTimeout(2000);
          return;
        }
      } catch (error) {
        continue;
      }
    }
    
    console.log('未找到跳过验证按钮');
    
  } catch (error) {
    console.log('邮箱认证处理过程中出现错误:', error.message);
  }
}

async function takeScreenshots() {
  let browser;
  
  try {
    // 确保目录存在
    const docsDir = path.join(__dirname, '..', 'docs');
    const screenshotsDir = path.join(docsDir, 'screenshots');
    
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    console.log('启动浏览器...');
    browser = await puppeteer.launch({ 
      headless: false,
      defaultViewport: null,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // 设置视口大小
    await page.setViewport({ width: 1920, height: 1080 });
    
    // 设置超时时间
    page.setDefaultTimeout(30000);
    
    // 首先访问首页
    console.log('访问首页...');
    await page.goto('http://localhost:4200', { waitUntil: 'networkidle0' });
    
    // 尝试使用 Amplify API 认证
    let loginSuccess = await loginWithAmplifyAPI(page);
    
    // 如果 API 认证失败，回退到 UI 操作
    if (!loginSuccess) {
      console.log('Amplify API 认证失败，尝试 UI 操作...');
      loginSuccess = await fallbackLogin(page);
    }
    
    if (!loginSuccess) {
      console.error('所有登录方法都失败了，无法继续截图');
      return;
    }
    
    console.log('✅ 登录成功，开始截图流程...');
    
    // 等待登录后的页面完全加载
    await page.waitForTimeout(5000);
    
    // 截图各个页面
    const pages = [
      { url: 'http://localhost:4200/dashboard', name: 'dashboard', title: 'Dashboard' },
      { url: 'http://localhost:4200/tenants', name: 'tenants', title: 'Tenants' },
      { url: 'http://localhost:4200/users', name: 'users', title: 'Users' }
    ];
    
    console.log(`准备截图 ${pages.length} 个页面...`);
    
    for (let i = 0; i < pages.length; i++) {
      const pageInfo = pages[i];
      try {
        console.log(`\n[${i + 1}/${pages.length}] 正在访问: ${pageInfo.url}`);
        
        // 访问页面
        console.log('导航到页面...');
        const response = await page.goto(pageInfo.url, { 
          waitUntil: 'networkidle0',
          timeout: 30000 
        });
        
        if (!response.ok()) {
          console.error(`页面访问失败: ${response.status()} ${response.statusText()}`);
          continue;
        }
        
        console.log(`页面加载成功，等待内容渲染...`);
        
        // 等待页面内容加载
        try {
          await page.waitForSelector('app-root', { timeout: 15000 });
          console.log('找到 app-root 元素');
        } catch (error) {
          console.log('未找到 app-root，尝试等待 body 元素');
          await page.waitForTimeout(15000);
        }
        
        // 额外等待时间确保页面完全渲染
        console.log('等待页面完全渲染...');
        await page.waitForTimeout(8000);
        
        // 检查页面是否有内容
        const pageContent = await page.evaluate(() => {
          return document.body.innerText;
        });
        
        console.log(`页面内容长度: ${pageContent ? pageContent.trim().length : 0} 字符`);
        
        if (!pageContent || pageContent.trim().length < 10) {
          console.warn(`页面内容可能未完全加载: ${pageContent ? pageContent.substring(0, 100) : '无内容'}...`);
        }
        
        console.log(`正在截图: ${pageInfo.title}`);
        
        // 截图
        const screenshotPath = path.join(screenshotsDir, `${pageInfo.name}.png`);
        await page.screenshot({ 
          path: screenshotPath,
          fullPage: true 
        });
        
        console.log(`✓ ${pageInfo.title} 截图完成: ${screenshotPath}`);
        
        // 截图成功后等待一下再继续下一个
        await page.waitForTimeout(2000);
        
      } catch (error) {
        console.error(`✗ ${pageInfo.title} 截图失败:`, error.message);
        
        // 尝试截图错误页面
        try {
          const errorScreenshotPath = path.join(screenshotsDir, `${pageInfo.name}_error.png`);
          await page.screenshot({ 
            path: errorScreenshotPath,
            fullPage: true 
          });
          console.log(`错误页面截图已保存: ${errorScreenshotPath}`);
        } catch (screenshotError) {
          console.error('错误页面截图也失败了:', screenshotError.message);
        }
      }
    }
    
    console.log('\n✅ 所有页面截图完成！');
    
  } catch (error) {
    console.error('截图过程中发生错误:', error);
  } finally {
    if (browser) {
      console.log('关闭浏览器...');
      await browser.close();
    }
  }
}

// 添加调试函数
async function debugPage(page, pageName) {
  console.log(`\n🔍 调试页面: ${pageName}`);
  
  try {
    // 获取页面标题
    const title = await page.title();
    console.log(`页面标题: ${title}`);
    
    // 获取当前 URL
    const url = page.url();
    console.log(`当前 URL: ${url}`);
    
    // 检查页面元素
    const elements = await page.evaluate(() => {
      const selectors = [
        'app-root',
        'amplify-authenticator',
        'body',
        'h1', 'h2', 'h3',
        '.container', '.content', '.main'
      ];
      
      const results = {};
      selectors.forEach(selector => {
        const element = document.querySelector(selector);
        results[selector] = {
          exists: !!element,
          visible: element ? element.offsetParent !== null : false,
          text: element ? element.textContent.substring(0, 100) : null
        };
      });
      
      return results;
    });
    
    console.log('页面元素状态:', JSON.stringify(elements, null, 2));
    
    // 截图当前页面状态
    const debugPath = path.join(__dirname, '..', 'docs', 'screenshots', `${pageName}_debug.png`);
    await page.screenshot({ path: debugPath, fullPage: true });
    console.log(`调试截图已保存: ${debugPath}`);
    
  } catch (error) {
    console.error('调试过程中出错:', error.message);
  }
}

// 主函数
async function main() {
  console.log('🚀 开始执行截图脚本...');
  console.log('当前工作目录:', process.cwd());
  console.log('脚本路径:', __dirname);
  
  console.log('\n检查应用是否运行...');
  const isRunning = await checkAppRunning();
  
  if (!isRunning) {
    console.error('❌ Angular 应用未运行！');
    console.log('请先运行: npm start');
    console.log('等待应用启动完成后再运行此脚本');
    return;
  }
  
  console.log('✅ Angular 应用正在运行');
  console.log('\n开始执行截图流程...');
  
  try {
    await takeScreenshots();
    console.log('\n✅ 截图脚本执行完成！');
  } catch (error) {
    console.error('\n❌ 截图脚本执行失败:', error);
  }
}

// 添加错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的 Promise 拒绝:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
});

main().catch(console.error);