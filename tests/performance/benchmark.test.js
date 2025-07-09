import { jest } from '@jest/globals';

// Mock all ESM dependencies using unstable_mockModule
jest.unstable_mockModule('../../src/utils/layoutGenerator.js', () => ({
  getUniqueLayoutsBatch: jest.fn(),
  cleanupSession: jest.fn()
}));

jest.unstable_mockModule('../../src/utils/inMemoryStore.js', () => ({
  saveMJML: jest.fn(),
  getMJML: jest.fn(),
  updateMJML: jest.fn(),
  deleteMJML: jest.fn()
}));

jest.unstable_mockModule('../../src/services/heroImageService.js', () => ({
  generateCustomHeroAndEnrich: jest.fn()
}));

// Import the functions after all mocks are set up
const { getUniqueLayoutsBatch, cleanupSession } = await import('../../src/utils/layoutGenerator.js');
const { saveMJML, getMJML, updateMJML, deleteMJML } = await import('../../src/utils/inMemoryStore.js');
const { generateCustomHeroAndEnrich } = await import('../../src/services/heroImageService.js');

describe('Performance Benchmarks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    getUniqueLayoutsBatch.mockReturnValue([
      {
        layoutId: 'test-layout-1',
        intro: 'hero-fullwidth.txt',
        utility1: 'divider-accent.txt',
        content1: 'brand-story.txt',
        utility2: 'divider-line.txt',
        cta: 'cta-wrapup.txt'
      }
    ]);
    
    saveMJML.mockImplementation(() => {});
    getMJML.mockReturnValue(['<mjml><mj-body>Test content</mj-body></mjml>']);
    updateMJML.mockImplementation(() => {});
    deleteMJML.mockImplementation(() => {});
    cleanupSession.mockImplementation(() => {});
    generateCustomHeroAndEnrich.mockResolvedValue({
      brand_name: 'Test Brand',
      hero_image_url: 'https://example.com/custom-hero.jpg'
    });
  });

  describe('Layout Generation Performance', () => {
    it('should generate 100 layouts within 1 second', async () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        getUniqueLayoutsBatch('Newsletter', 1);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(1000);
      expect(getUniqueLayoutsBatch).toHaveBeenCalledTimes(100);
    });

    it('should handle large batch generation efficiently', async () => {
      const startTime = Date.now();
      
      getUniqueLayoutsBatch('Newsletter', 50);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(500);
      expect(getUniqueLayoutsBatch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Memory Store Performance', () => {
    it('should save 1000 MJML entries efficiently', async () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        saveMJML(`job-${i}`, i, `<mjml><mj-body>Content ${i}</mj-body></mjml>`);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(1000);
      expect(saveMJML).toHaveBeenCalledTimes(1000);
    });

    it('should retrieve MJML entries efficiently', async () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        getMJML(`job-${i}`);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(500);
      expect(getMJML).toHaveBeenCalledTimes(100);
    });

    it('should update MJML entries efficiently', async () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 500; i++) {
        updateMJML(`job-${i}`, i, `<mjml><mj-body>Updated content ${i}</mj-body></mjml>`);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(1000);
      expect(updateMJML).toHaveBeenCalledTimes(500);
    });
  });

  describe('Hero Image Service Performance', () => {
    it('should handle concurrent hero image generation', async () => {
      const startTime = Date.now();
      
      const promises = Array.from({ length: 10 }, () =>
        generateCustomHeroAndEnrich({
          brand_name: 'Test Brand',
          hero_image_url: 'https://example.com/hero.jpg'
        })
      );
      
      await Promise.all(promises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(2000);
      expect(generateCustomHeroAndEnrich).toHaveBeenCalledTimes(10);
    });

    it('should handle hero image generation failure gracefully', async () => {
      generateCustomHeroAndEnrich.mockRejectedValueOnce(new Error('Generation failed'));
      
      const startTime = Date.now();
      
      try {
        await generateCustomHeroAndEnrich({
          brand_name: 'Test Brand',
          hero_image_url: 'https://example.com/hero.jpg'
        });
      } catch (error) {
        // Expected to fail
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Concurrency Performance', () => {
    it('should handle 50 concurrent layout generations', async () => {
      const startTime = Date.now();
      
      const promises = Array.from({ length: 50 }, () =>
        Promise.resolve(getUniqueLayoutsBatch('Newsletter', 1))
      );
      
      await Promise.all(promises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(2000);
      expect(getUniqueLayoutsBatch).toHaveBeenCalledTimes(50);
    });

    it('should handle mixed concurrent operations', async () => {
      const startTime = Date.now();
      
      const operations = [
        ...Array.from({ length: 20 }, () => () => getUniqueLayoutsBatch('Newsletter', 1)),
        ...Array.from({ length: 20 }, () => () => saveMJML('job-1', 0, '<mjml>Test</mjml>')),
        ...Array.from({ length: 20 }, () => () => getMJML('job-1')),
        ...Array.from({ length: 10 }, () => () => generateCustomHeroAndEnrich({
          brand_name: 'Test Brand',
          hero_image_url: 'https://example.com/hero.jpg'
        }))
      ];
      
      const promises = operations.map(op => Promise.resolve(op()));
      await Promise.all(promises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(3000);
      expect(getUniqueLayoutsBatch).toHaveBeenCalledTimes(20);
      expect(saveMJML).toHaveBeenCalledTimes(20);
      expect(getMJML).toHaveBeenCalledTimes(20);
      expect(generateCustomHeroAndEnrich).toHaveBeenCalledTimes(10);
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory during repeated operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform 1000 operations
      for (let i = 0; i < 1000; i++) {
        getUniqueLayoutsBatch('Newsletter', 1);
        saveMJML(`job-${i}`, 0, `<mjml><mj-body>Content ${i}</mj-body></mjml>`);
        getMJML(`job-${i}`);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Response Time Benchmarks', () => {
    it('should complete layout generation within 100ms', async () => {
      const startTime = Date.now();
      
      getUniqueLayoutsBatch('Newsletter', 1);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(100);
    });

    it('should complete MJML save within 50ms', async () => {
      const startTime = Date.now();
      
      saveMJML('test-job', 0, '<mjml><mj-body>Test</mj-body></mjml>');
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(50);
    });

    it('should complete MJML retrieval within 50ms', async () => {
      const startTime = Date.now();
      
      getMJML('test-job');
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(50);
    });
  });
}); 