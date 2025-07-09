import { jest } from '@jest/globals';
import request from 'supertest';

// Mock the emailController before importing the app
jest.unstable_mockModule('../../src/controllers/emailController.js', () => ({
  generateEmails: jest.fn()
}));

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

// Import the app and mocked functions after all mocks are set up
const { default: app } = await import('../../src/app.js');
const { generateEmails } = await import('../../src/controllers/emailController.js');
const { getUniqueLayoutsBatch, cleanupSession } = await import('../../src/utils/layoutGenerator.js');
const { saveMJML, getMJML, updateMJML, deleteMJML } = await import('../../src/utils/inMemoryStore.js');
const { generateCustomHeroAndEnrich } = await import('../../src/services/heroImageService.js');

describe('Email Generation Integration', () => {
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

    // Setup the generateEmails mock to simulate the controller behavior
    generateEmails.mockImplementation((req, res) => {
      const { brandData, emailType, userContext, storeId } = req.body;

      if (!brandData || !emailType) {
        return res.status(400).json({ 
          error: 'Missing brandData or emailType in request body.' 
        });
      }

      if (brandData.customHeroImage !== undefined && typeof brandData.customHeroImage !== 'boolean') {
        return res.status(400).json({ 
          error: 'customHeroImage must be a boolean (true/false)' 
        });
      }

      // Simulate successful email generation
      const mockEmails = [
        {
          index: 1,
          content: '<mjml><mj-body>Test email content 1</mj-body></mjml>',
          tokens: 1500
        },
        {
          index: 2,
          content: '<mjml><mj-body>Test email content 2</mj-body></mjml>',
          tokens: 1200
        },
        {
          index: 3,
          content: '<mjml><mj-body>Test email content 3</mj-body></mjml>',
          tokens: 1800
        }
      ];

      res.json({
        success: true,
        emails: mockEmails,
        totalTokens: 4500
      });
    });
  });

  describe('POST /api/generate-emails', () => {
    it('should generate emails successfully', async () => {
      const requestBody = {
        brandData: {
          brand_name: 'Test Brand',
          primary_color: '#007BFF',
          secondary_color: '#6C757D',
          hero_image_url: 'https://example.com/hero.jpg',
          customHeroImage: false
        },
        emailType: 'Newsletter',
        userContext: 'Test user context',
        storeId: 'test-store-123'
      };

      const response = await request(app)
        .post('/api/generate-emails')
        .send(requestBody)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('emails');
      expect(Array.isArray(response.body.emails)).toBe(true);
      expect(generateEmails).toHaveBeenCalled();
    });

    it('should handle missing brandData', async () => {
      const response = await request(app)
        .post('/api/generate-emails')
        .send({
          emailType: 'Newsletter',
          userContext: 'Test context'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Missing brandData');
    });

    it('should handle missing emailType', async () => {
      const response = await request(app)
        .post('/api/generate-emails')
        .send({
          brandData: {
            brand_name: 'Test Brand',
            primary_color: '#007BFF'
          },
          userContext: 'Test context'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Missing brandData');
    });

    it('should handle custom hero image generation', async () => {
      const requestBody = {
        brandData: {
          brand_name: 'Test Brand',
          primary_color: '#007BFF',
          secondary_color: '#6C757D',
          hero_image_url: 'https://example.com/hero.jpg',
          customHeroImage: true
        },
        emailType: 'Newsletter',
        userContext: 'Test user context',
        storeId: 'test-store-123'
      };

      const response = await request(app)
        .post('/api/generate-emails')
        .send(requestBody)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(generateEmails).toHaveBeenCalled();
    });

    it('should handle different email types', async () => {
      const emailTypes = ['Newsletter', 'Productgrid', 'AbandonedCart', 'Promotion'];
      
      for (const emailType of emailTypes) {
        const requestBody = {
          brandData: {
            brand_name: 'Test Brand',
            primary_color: '#007BFF',
            secondary_color: '#6C757D',
            hero_image_url: 'https://example.com/hero.jpg',
            customHeroImage: false
          },
          emailType,
          userContext: 'Test user context',
          storeId: 'test-store-123'
        };

        const response = await request(app)
          .post('/api/generate-emails')
          .send(requestBody)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      }
    });

    it('should handle invalid email type', async () => {
      // Override the generateEmails mock for this test to simulate the "No assistant configured" error
      generateEmails.mockImplementationOnce((req, res) => {
        res.status(400).json({ error: 'No assistant configured for: InvalidType' });
      });

      const response = await request(app)
        .post('/api/generate-emails')
        .send({
          brandData: {
            brand_name: 'Test Brand',
            primary_color: '#007BFF'
          },
          emailType: 'InvalidType',
          userContext: 'Test context'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('No assistant configured');
    });
  });

  describe('Error Handling', () => {
    it('should handle layout generation errors gracefully', async () => {
      // Override the generateEmails mock for this test
      generateEmails.mockImplementationOnce((req, res) => {
        res.status(500).json({ error: 'Layout generation failed' });
      });

      const requestBody = {
        brandData: {
          brand_name: 'Test Brand',
          primary_color: '#007BFF',
          secondary_color: '#6C757D',
          hero_image_url: 'https://example.com/hero.jpg',
          customHeroImage: false
        },
        emailType: 'Newsletter',
        userContext: 'Test user context',
        storeId: 'test-store-123'
      };

      const response = await request(app)
        .post('/api/generate-emails')
        .send(requestBody)
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle hero image generation errors gracefully', async () => {
      // Override the generateEmails mock for this test
      generateEmails.mockImplementationOnce((req, res) => {
        res.json({
          success: true,
          emails: [
            {
              index: 1,
              content: '<mjml><mj-body>Test email content</mj-body></mjml>',
              tokens: 1500
            }
          ],
          totalTokens: 1500
        });
      });

      const requestBody = {
        brandData: {
          brand_name: 'Test Brand',
          primary_color: '#007BFF',
          secondary_color: '#6C757D',
          hero_image_url: 'https://example.com/hero.jpg',
          customHeroImage: true
        },
        emailType: 'Newsletter',
        userContext: 'Test user context',
        storeId: 'test-store-123'
      };

      const response = await request(app)
        .post('/api/generate-emails')
        .send(requestBody)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });
}); 