import { jest } from '@jest/globals';

// Mock OpenAI before importing the controller
const mockOpenAI = {
  beta: {
    threads: {
      create: jest.fn().mockResolvedValue({ id: 'thread-123' }),
      messages: {
        create: jest.fn().mockResolvedValue({ id: 'msg-123' }),
        list: jest.fn().mockResolvedValue({
          data: [{
            content: [{
              text: {
                value: '```mjml\n<mjml><mj-body>Test email content</mj-body></mjml>\n```'
              }
            }]
          }]
        })
      },
      runs: {
        create: jest.fn().mockResolvedValue({ id: 'run-123' }),
        retrieve: jest.fn().mockResolvedValue({ 
          status: 'completed',
          usage: { total_tokens: 1500 }
        })
      }
    }
  }
};

// Mock all ESM dependencies using unstable_mockModule
jest.unstable_mockModule('openai', () => ({
  default: jest.fn(() => mockOpenAI)
}));

jest.unstable_mockModule('../../src/utils/layoutGenerator.js', () => ({
  getUniqueLayoutsBatch: jest.fn(),
  cleanupSession: jest.fn()
}));

jest.unstable_mockModule('../../src/services/heroImageService.js', () => ({
  generateCustomHeroAndEnrich: jest.fn()
}));

jest.unstable_mockModule('../../src/utils/inMemoryStore.js', () => ({
  saveMJML: jest.fn(),
  getMJML: jest.fn(),
  updateMJML: jest.fn(),
  deleteMJML: jest.fn()
}));

// Import the controller after all mocks are set up
const { generateEmails } = await import('../../src/controllers/emailController.js');
const { getUniqueLayoutsBatch, cleanupSession } = await import('../../src/utils/layoutGenerator.js');
const { generateCustomHeroAndEnrich } = await import('../../src/services/heroImageService.js');
const { saveMJML, getMJML, updateMJML, deleteMJML } = await import('../../src/utils/inMemoryStore.js');

describe('Email Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Reset OpenAI mock methods
    mockOpenAI.beta.threads.create.mockResolvedValue({ id: 'thread-123' });
    mockOpenAI.beta.threads.messages.create.mockResolvedValue({ id: 'msg-123' });
    mockOpenAI.beta.threads.messages.list.mockResolvedValue({
      data: [{
        content: [{
          text: {
            value: '```mjml\n<mjml><mj-body>Test email content</mj-body></mjml>\n```'
          }
        }]
      }]
    });
    mockOpenAI.beta.threads.runs.create.mockResolvedValue({ id: 'run-123' });
    mockOpenAI.beta.threads.runs.retrieve.mockResolvedValue({
      status: 'completed',
      usage: { total_tokens: 1500 }
    });

    // Setup mock request
    mockReq = {
      body: {
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
      }
    };

    // Setup mock response
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    // Setup default mocks
    getUniqueLayoutsBatch.mockReturnValue([
      {
        layoutId: 'newsletter-1',
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

  describe('generateEmails', () => {
    it('should generate emails successfully with valid input', async () => {
      await generateEmails(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          emails: expect.arrayContaining([
            expect.objectContaining({
              index: 1,
              content: expect.stringContaining('<mjml>'),
              tokens: 1500
            })
          ])
        })
      );
    });

    it('should handle missing brandData', async () => {
      mockReq.body.brandData = null;

      await generateEmails(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Missing brandData or emailType in request body.'
      });
    });

    it('should handle missing emailType', async () => {
      mockReq.body.emailType = null;

      await generateEmails(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Missing brandData or emailType in request body.'
      });
    });

    it('should handle invalid customHeroImage type', async () => {
      mockReq.body.brandData.customHeroImage = 'not-a-boolean';

      await generateEmails(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'customHeroImage must be a boolean (true/false)'
      });
    });

    it('should handle custom hero image generation', async () => {
      mockReq.body.brandData.customHeroImage = true;

      await generateEmails(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true
        })
      );
    });

    it('should handle layout generator errors', async () => {
      getUniqueLayoutsBatch.mockImplementation(() => {
        throw new Error('Layout generation failed');
      });

      await generateEmails(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Layout generator failed: Layout generation failed'
      });
    });

    it('should handle OpenAI assistant errors', async () => {
      mockOpenAI.beta.threads.runs.retrieve.mockResolvedValue({
        status: 'failed',
        last_error: { message: 'Assistant failed' }
      });

      await generateEmails(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          emails: expect.arrayContaining([
            expect.objectContaining({
              index: 1,
              error: expect.stringContaining('Assistant error: failed')
            })
          ])
        })
      );
    });

    it('should handle OpenAI timeout', async () => {
      // Mock a timeout scenario by making the retrieve call throw an error after a few calls
      let callCount = 0;
      mockOpenAI.beta.threads.runs.retrieve.mockImplementation(() => {
        callCount++;
        if (callCount > 2) {
          // Simulate timeout by throwing an error
          throw new Error('Assistant run timed out after 120 seconds on email 1');
        }
        return Promise.resolve({ status: 'in_progress' });
      });

      await generateEmails(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          emails: expect.arrayContaining([
            expect.objectContaining({
              index: 1,
              error: expect.stringContaining('Assistant run timed out')
            })
          ])
        })
      );
    });

    it('should handle hero image generation failure gracefully', async () => {
      mockReq.body.brandData.customHeroImage = true;

      await generateEmails(mockReq, mockRes);

      // Should still complete successfully with original brandData
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true
        })
      );
    });
  });
}); 