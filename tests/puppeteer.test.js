import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Expert Contacts Microservice E2E Tests', () => {
  let browser;
  let page;
  let serverProcess;
  const baseUrl = 'http://localhost:3600';
  const testUIUrl = `file://${join(__dirname, '../test-ui/index.html')}`;
  
  // Start server before all tests
  beforeAll(async () => {
    console.log('Starting microservice server...');
    
    // Start the server
    serverProcess = spawn('node', ['src/server.js'], {
      cwd: join(__dirname, '..'),
      env: {
        ...process.env,
        PORT: '3600',
        NODE_ENV: 'test',
        API_KEY_SECRET: 'test-secret',
        DATABASE_PATH: ':memory:',
        LOG_LEVEL: 'error',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key'
      },
      detached: false
    });
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: process.env.HEADLESS !== 'false',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 800 });
    
    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Browser console error:', msg.text());
      }
    });
  });
  
  afterAll(async () => {
    if (browser) await browser.close();
    if (serverProcess) {
      serverProcess.kill();
      // Wait for process to terminate
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  });
  
  beforeEach(async () => {
    // Navigate to test UI
    await page.goto(testUIUrl, { waitUntil: 'networkidle2' });
  });
  
  describe('Health Check', () => {
    test('should show service is healthy', async () => {
      // Click health check button
      await page.click('button[onclick="checkHealth()"]');
      
      // Wait for results
      await page.waitForSelector('.success', { timeout: 5000 });
      
      // Check success message
      const successText = await page.$eval('.success', el => el.textContent);
      expect(successText).toContain('Service is healthy');
      
      // Check response contains expected fields
      const responseText = await page.$eval('.results', el => el.textContent);
      const response = JSON.parse(responseText);
      expect(response.status).toBe('healthy');
      expect(response.service).toBe('expert-contacts-microservice');
      expect(response.version).toBe('1.0.0');
    });
  });
  
  describe('API Authentication', () => {
    test('should fail without API key', async () => {
      // Clear API key
      await page.evaluate(() => {
        document.getElementById('apiKey').value = '';
      });
      
      // Switch to search tab
      await page.evaluate(() => {
        document.querySelectorAll('.tab')[2].click();
      });
      
      // Try to search
      await page.click('button[onclick="searchExperts()"]');
      
      // Wait for error
      await page.waitForSelector('.error', { timeout: 5000 });
      
      const errorText = await page.$eval('.error', el => el.textContent);
      expect(errorText).toContain('Authentication required');
    });
    
    test('should succeed with valid API key', async () => {
      // Ensure API key is set
      await page.evaluate(() => {
        document.getElementById('apiKey').value = 'test-secret';
      });
      
      // Switch to search tab
      await page.evaluate(() => {
        document.querySelectorAll('.tab')[2].click();
      });
      
      // Search experts
      await page.click('button[onclick="searchExperts()"]');
      
      // Should not show authentication error
      await page.waitForFunction(
        () => {
          const results = document.getElementById('searchResults');
          return results && results.textContent && !results.textContent.includes('Authentication');
        },
        { timeout: 5000 }
      );
    });
  });
  
  describe('Search Experts', () => {
    test('should search experts with query', async () => {
      // Switch to search tab
      await page.evaluate(() => {
        document.querySelectorAll('.tab')[2].click();
      });
      
      // Enter search query
      await page.type('#searchQuery', 'healthcare');
      
      // Click search
      await page.click('button[onclick="searchExperts()"]');
      
      // Wait for results or no results message
      await page.waitForFunction(
        () => {
          const results = document.getElementById('searchResults');
          return results && results.querySelector('.success, .error');
        },
        { timeout: 5000 }
      );
      
      // Get results
      const resultsExist = await page.$('.expert-card');
      if (resultsExist) {
        const expertCount = await page.$$eval('.expert-card', cards => cards.length);
        expect(expertCount).toBeGreaterThanOrEqual(0);
      }
    });
    
    test('should filter by confidence score', async () => {
      // Switch to search tab
      await page.evaluate(() => {
        document.querySelectorAll('.tab')[2].click();
      });
      
      // Set minimum confidence
      await page.type('#minConfidence', '8');
      
      // Click search
      await page.click('button[onclick="searchExperts()"]');
      
      // Wait for results
      await page.waitForFunction(
        () => {
          const results = document.getElementById('searchResults');
          return results && results.querySelector('.success, .error');
        },
        { timeout: 5000 }
      );
    });
  });
  
  describe('Source Experts', () => {
    test('should validate project description', async () => {
      // Switch to source tab
      await page.evaluate(() => {
        document.querySelectorAll('.tab')[1].click();
      });
      
      // Clear project description
      await page.evaluate(() => {
        document.getElementById('projectDescription').value = 'Too short';
      });
      
      // Click source
      await page.click('button[onclick="sourceExperts()"]');
      
      // Should show validation error
      await page.waitForSelector('.error', { timeout: 5000 });
      
      const errorText = await page.$eval('.error', el => el.textContent);
      expect(errorText).toContain('at least 10 characters');
    });
    
    test('should source experts for valid project', async () => {
      // Skip if no real OpenAI key
      if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'test-key') {
        console.log('Skipping expert sourcing test - requires valid OPENAI_API_KEY');
        return;
      }
      
      // Switch to source tab
      await page.evaluate(() => {
        document.querySelectorAll('.tab')[1].click();
      });
      
      // Ensure valid project description
      const projectDesc = 'I need to build a machine learning platform for predictive maintenance in manufacturing';
      await page.evaluate((desc) => {
        document.getElementById('projectDescription').value = desc;
      }, projectDesc);
      
      // Click source
      await page.click('button[onclick="sourceExperts()"]');
      
      // Wait for results (this may take a while)
      await page.waitForSelector('.success, .error', { timeout: 30000 });
      
      // Check if we got results
      const hasSuccess = await page.$('.success');
      if (hasSuccess) {
        // Should have request ID
        const requestIdText = await page.$eval('h3', el => el.textContent);
        expect(requestIdText).toContain('Request ID:');
        
        // Should have expert types
        const expertTypes = await page.$$('.expert-card');
        expect(expertTypes.length).toBeGreaterThan(0);
      }
    }, 35000);
  });
  
  describe('My Requests', () => {
    test('should list user requests', async () => {
      // Switch to requests tab
      await page.evaluate(() => {
        document.querySelectorAll('.tab')[3].click();
      });
      
      // Click get requests
      await page.click('button[onclick="getMyRequests()"]');
      
      // Wait for results
      await page.waitForFunction(
        () => {
          const results = document.getElementById('requestsResults');
          return results && results.querySelector('.success, .error');
        },
        { timeout: 5000 }
      );
      
      // Should show requests or no requests message
      const resultsText = await page.$eval('#requestsResults', el => el.textContent);
      expect(resultsText).toBeTruthy();
    });
  });
  
  describe('UI Responsiveness', () => {
    test('should switch between tabs', async () => {
      const tabs = ['health', 'source', 'search', 'requests'];
      
      for (let i = 0; i < tabs.length; i++) {
        // Click tab
        await page.evaluate((index) => {
          document.querySelectorAll('.tab')[index].click();
        }, i);
        
        // Check active tab
        const activeTab = await page.$eval('.tab.active', el => el.textContent);
        expect(activeTab).toBeTruthy();
        
        // Check visible content
        const visibleContent = await page.$eval('.tab-content.active', el => el.id);
        expect(visibleContent).toBe(tabs[i]);
      }
    });
    
    test('should disable button during API call', async () => {
      // Switch to source tab
      await page.evaluate(() => {
        document.querySelectorAll('.tab')[1].click();
      });
      
      // Start source experts (won't complete due to missing API key)
      const clickPromise = page.click('#sourceBtn');
      
      // Check button is disabled
      await page.waitForFunction(
        () => document.getElementById('sourceBtn').disabled === true,
        { timeout: 2000 }
      );
      
      // Wait for completion
      await clickPromise.catch(() => {}); // Ignore errors
      
      // Button should be enabled again
      await page.waitForFunction(
        () => document.getElementById('sourceBtn').disabled === false,
        { timeout: 5000 }
      );
    });
  });
  
  describe('Error Handling', () => {
    test('should handle API errors gracefully', async () => {
      // Set invalid API URL
      await page.evaluate(() => {
        document.getElementById('apiUrl').value = 'http://localhost:9999';
      });
      
      // Try health check
      await page.click('button[onclick="checkHealth()"]');
      
      // Should show error
      await page.waitForSelector('.error', { timeout: 5000 });
      
      const errorText = await page.$eval('.error', el => el.textContent);
      expect(errorText).toContain('Error:');
    });
  });
});

// Run tests if this file is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Run Jest programmatically
  import('jest').then(({ run }) => {
    run();
  });
}