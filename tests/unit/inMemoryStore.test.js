import { jest } from '@jest/globals';
import { saveMJML, getMJML, updateMJML, deleteMJML, debugStore } from '../../src/utils/inMemoryStore.js';

describe('InMemoryStore', () => {
  beforeEach(() => {
    // Clear the store before each test
    // We need to access the internal store to clear it
    // This is a bit of a hack since the store is not exported
    // In a real implementation, we might want to add a clear() method
    jest.resetModules();
  });

  describe('saveMJML', () => {
    test('should save MJML content correctly', () => {
      const jobId = 'test-job-123';
      const index = 0;
      const mjmlContent = '<mjml><mj-body>Test content</mj-body></mjml>';
      
      saveMJML(jobId, index, mjmlContent);
      
      const result = getMJML(jobId);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(mjmlContent);
    });

    test('should save multiple MJMLs for same job', () => {
      const jobId = 'test-job-456';
      const mjml1 = '<mjml><mj-body>Content 1</mj-body></mjml>';
      const mjml2 = '<mjml><mj-body>Content 2</mj-body></mjml>';
      
      saveMJML(jobId, 0, mjml1);
      saveMJML(jobId, 1, mjml2);
      
      const result = getMJML(jobId);
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(mjml1);
      expect(result[1]).toBe(mjml2);
    });

    test('should handle sparse array indices', () => {
      const jobId = 'test-job-789';
      const mjml1 = '<mjml><mj-body>Content 1</mj-body></mjml>';
      const mjml2 = '<mjml><mj-body>Content 2</mj-body></mjml>';
      
      saveMJML(jobId, 5, mjml1);
      saveMJML(jobId, 10, mjml2);
      
      const result = getMJML(jobId);
      expect(result).toHaveLength(11);
      expect(result[5]).toBe(mjml1);
      expect(result[10]).toBe(mjml2);
      expect(result[0]).toBeUndefined();
      expect(result[1]).toBeUndefined();
    });

    test('should throw error for missing parameters', () => {
      expect(() => saveMJML('job-id', 0)).toThrow(
        'saveMJML requires 3 parameters: jobId, index, mjml. Got: 2'
      );
      
      expect(() => saveMJML('job-id')).toThrow(
        'saveMJML requires 3 parameters: jobId, index, mjml. Got: 1'
      );
      
      expect(() => saveMJML()).toThrow(
        'saveMJML requires 3 parameters: jobId, index, mjml. Got: 0'
      );
    });

    test('should handle undefined mjml content', () => {
      const jobId = 'test-job-undefined';
      
      expect(() => saveMJML(jobId, 0, undefined)).toThrow(
        'saveMJML requires 3 parameters: jobId, index, mjml. Got: 3'
      );
    });

    test('should handle empty string mjml content', () => {
      const jobId = 'test-job-empty';
      
      saveMJML(jobId, 0, '');
      
      const result = getMJML(jobId);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('');
    });

    test('should handle null mjml content', () => {
      const jobId = 'test-job-null';
      
      saveMJML(jobId, 0, null);
      
      const result = getMJML(jobId);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(null);
    });
  });

  describe('getMJML', () => {
    test('should return empty array for non-existent job', () => {
      const result = getMJML('non-existent-job');
      expect(result).toEqual([]);
    });

    test('should return all MJMLs for a job', () => {
      const jobId = 'test-job-get';
      const mjml1 = '<mjml><mj-body>Content 1</mj-body></mjml>';
      const mjml2 = '<mjml><mj-body>Content 2</mj-body></mjml>';
      const mjml3 = '<mjml><mj-body>Content 3</mj-body></mjml>';
      
      saveMJML(jobId, 0, mjml1);
      saveMJML(jobId, 1, mjml2);
      saveMJML(jobId, 2, mjml3);
      
      const result = getMJML(jobId);
      expect(result).toHaveLength(3);
      expect(result).toEqual([mjml1, mjml2, mjml3]);
    });

    test('should handle multiple jobs independently', () => {
      const jobId1 = 'test-job-1';
      const jobId2 = 'test-job-2';
      const mjml1 = '<mjml><mj-body>Job 1 content</mj-body></mjml>';
      const mjml2 = '<mjml><mj-body>Job 2 content</mj-body></mjml>';
      
      saveMJML(jobId1, 0, mjml1);
      saveMJML(jobId2, 0, mjml2);
      
      const result1 = getMJML(jobId1);
      const result2 = getMJML(jobId2);
      
      expect(result1).toEqual([mjml1]);
      expect(result2).toEqual([mjml2]);
    });

    test('should return sparse array for sparse indices', () => {
      const jobId = 'test-job-sparse';
      const mjml1 = '<mjml><mj-body>Content 1</mj-body></mjml>';
      const mjml2 = '<mjml><mj-body>Content 2</mj-body></mjml>';
      
      saveMJML(jobId, 0, mjml1);
      saveMJML(jobId, 5, mjml2);
      
      const result = getMJML(jobId);
      expect(result).toHaveLength(6);
      expect(result[0]).toBe(mjml1);
      expect(result[5]).toBe(mjml2);
      expect(result[1]).toBeUndefined();
      expect(result[2]).toBeUndefined();
      expect(result[3]).toBeUndefined();
      expect(result[4]).toBeUndefined();
    });
  });

  describe('updateMJML', () => {
    test('should update existing MJML content', () => {
      const jobId = 'test-job-update';
      const originalMjml = '<mjml><mj-body>Original content</mj-body></mjml>';
      const updatedMjml = '<mjml><mj-body>Updated content</mj-body></mjml>';
      
      saveMJML(jobId, 0, originalMjml);
      updateMJML(jobId, 0, updatedMjml);
      
      const result = getMJML(jobId);
      expect(result[0]).toBe(updatedMjml);
    });

    test('should create new entry if index does not exist', () => {
      const jobId = 'test-job-update-new';
      const mjml = '<mjml><mj-body>New content</mj-body></mjml>';
      
      updateMJML(jobId, 0, mjml);
      
      const result = getMJML(jobId);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(mjml);
    });

    test('should handle updating at different indices', () => {
      const jobId = 'test-job-update-multiple';
      const mjml1 = '<mjml><mj-body>Content 1</mj-body></mjml>';
      const mjml2 = '<mjml><mj-body>Content 2</mj-body></mjml>';
      const updatedMjml2 = '<mjml><mj-body>Updated content 2</mj-body></mjml>';
      
      saveMJML(jobId, 0, mjml1);
      saveMJML(jobId, 1, mjml2);
      updateMJML(jobId, 1, updatedMjml2);
      
      const result = getMJML(jobId);
      expect(result[0]).toBe(mjml1);
      expect(result[1]).toBe(updatedMjml2);
    });

    test('should handle updating with null content', () => {
      const jobId = 'test-job-update-null';
      const originalMjml = '<mjml><mj-body>Original content</mj-body></mjml>';
      
      saveMJML(jobId, 0, originalMjml);
      updateMJML(jobId, 0, null);
      
      const result = getMJML(jobId);
      expect(result[0]).toBe(null);
    });

    test('should handle updating with empty string', () => {
      const jobId = 'test-job-update-empty';
      const originalMjml = '<mjml><mj-body>Original content</mj-body></mjml>';
      
      saveMJML(jobId, 0, originalMjml);
      updateMJML(jobId, 0, '');
      
      const result = getMJML(jobId);
      expect(result[0]).toBe('');
    });
  });

  describe('deleteMJML', () => {
    test('should delete all MJMLs for a job', () => {
      const jobId = 'test-job-delete';
      const mjml1 = '<mjml><mj-body>Content 1</mj-body></mjml>';
      const mjml2 = '<mjml><mj-body>Content 2</mj-body></mjml>';
      
      saveMJML(jobId, 0, mjml1);
      saveMJML(jobId, 1, mjml2);
      
      deleteMJML(jobId);
      
      const result = getMJML(jobId);
      expect(result).toEqual([]);
    });

    test('should handle deleting non-existent job', () => {
      expect(() => deleteMJML('non-existent-job')).not.toThrow();
      
      const result = getMJML('non-existent-job');
      expect(result).toEqual([]);
    });

    test('should not affect other jobs when deleting one', () => {
      const jobId1 = 'test-job-delete-1';
      const jobId2 = 'test-job-delete-2';
      const mjml1 = '<mjml><mj-body>Job 1 content</mj-body></mjml>';
      const mjml2 = '<mjml><mj-body>Job 2 content</mj-body></mjml>';
      
      saveMJML(jobId1, 0, mjml1);
      saveMJML(jobId2, 0, mjml2);
      
      deleteMJML(jobId1);
      
      const result1 = getMJML(jobId1);
      const result2 = getMJML(jobId2);
      
      expect(result1).toEqual([]);
      expect(result2).toEqual([mjml2]);
    });

    test('should handle multiple deletions', () => {
      const jobId1 = 'test-job-delete-multi-1';
      const jobId2 = 'test-job-delete-multi-2';
      const jobId3 = 'test-job-delete-multi-3';
      
      saveMJML(jobId1, 0, 'content1');
      saveMJML(jobId2, 0, 'content2');
      saveMJML(jobId3, 0, 'content3');
      
      deleteMJML(jobId1);
      deleteMJML(jobId2);
      
      expect(getMJML(jobId1)).toEqual([]);
      expect(getMJML(jobId2)).toEqual([]);
      expect(getMJML(jobId3)).toEqual(['content3']);
    });
  });

  describe('debugStore', () => {
    test('should log store contents', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const jobId = 'test-job-debug';
      const mjml = '<mjml><mj-body>Debug content</mj-body></mjml>';
      
      saveMJML(jobId, 0, mjml);
      debugStore();
      
      expect(consoleSpy).toHaveBeenCalledWith('📦 Current store contents:');
      expect(consoleSpy).toHaveBeenCalledWith(`  Job ${jobId}: 1 MJMLs`);
      expect(consoleSpy).toHaveBeenCalledWith('    [0]: <mjml><mj-body>Debug content</mj-body></mjml>...');
      
      consoleSpy.mockRestore();
    });

    test('should handle empty store', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      debugStore();
      
      expect(consoleSpy).toHaveBeenCalledWith('📦 Current store contents:');
      
      consoleSpy.mockRestore();
    });

    test('should handle multiple jobs in debug output', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const jobId1 = 'test-job-debug-1';
      const jobId2 = 'test-job-debug-2';
      
      saveMJML(jobId1, 0, 'content1');
      saveMJML(jobId2, 0, 'content2');
      saveMJML(jobId2, 1, 'content3');
      
      debugStore();
      
      expect(consoleSpy).toHaveBeenCalledWith('📦 Current store contents:');
      expect(consoleSpy).toHaveBeenCalledWith(`  Job ${jobId1}: 1 MJMLs`);
      expect(consoleSpy).toHaveBeenCalledWith(`  Job ${jobId2}: 2 MJMLs`);
      
      consoleSpy.mockRestore();
    });

    test('should handle null content in debug output', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const jobId = 'test-job-debug-null';
      saveMJML(jobId, 0, null);
      
      debugStore();
      
      expect(consoleSpy).toHaveBeenCalledWith('📦 Current store contents:');
      expect(consoleSpy).toHaveBeenCalledWith(`  Job ${jobId}: 1 MJMLs`);
      expect(consoleSpy).toHaveBeenCalledWith('    [0]: null...');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    test('should handle very long MJML content', () => {
      const jobId = 'test-job-long';
      const longMjml = '<mjml><mj-body>' + 'x'.repeat(10000) + '</mj-body></mjml>';
      
      saveMJML(jobId, 0, longMjml);
      
      const result = getMJML(jobId);
      expect(result[0]).toBe(longMjml);
    });

    test('should handle special characters in MJML content', () => {
      const jobId = 'test-job-special';
      const specialMjml = '<mjml><mj-body>Content with "quotes" & <tags> and \'apostrophes\'</mj-body></mjml>';
      
      saveMJML(jobId, 0, specialMjml);
      
      const result = getMJML(jobId);
      expect(result[0]).toBe(specialMjml);
    });

    test('should handle unicode characters in MJML content', () => {
      const jobId = 'test-job-unicode';
      const unicodeMjml = '<mjml><mj-body>Content with émojis 🎉 and ñ characters</mj-body></mjml>';
      
      saveMJML(jobId, 0, unicodeMjml);
      
      const result = getMJML(jobId);
      expect(result[0]).toBe(unicodeMjml);
    });

    test('should handle job IDs with special characters', () => {
      const jobId = 'test-job-with-special-chars-123!@#$%^&*()';
      const mjml = '<mjml><mj-body>Content</mj-body></mjml>';
      
      saveMJML(jobId, 0, mjml);
      
      const result = getMJML(jobId);
      expect(result[0]).toBe(mjml);
    });

    test('should handle negative indices', () => {
      const jobId = 'test-job-negative';
      const mjml = '<mjml><mj-body>Content</mj-body></mjml>';
      
      saveMJML(jobId, -1, mjml);
      
      const result = getMJML(jobId);
      expect(result).toHaveLength(0); // Negative indices are not supported
    });
  });
}); 