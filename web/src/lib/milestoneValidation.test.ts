import { describe, expect, it, vi } from 'vitest';
import { createMilestoneValidator } from './milestoneValidation';

describe('shared milestone validator integration', () => {
  const file = new File(['synthetic material'], 'concept.svg', { type: 'image/svg+xml' });
  it('fails closed when the partner module is not published', async () => {
    await expect(createMilestoneValidator()(file, 0)).rejects.toThrow('File checks are temporarily unavailable');
  });
  it.each([0, 1, 2] as const)('delegates exactly the same file and stage %s to the shared validator', async index => {
    const validateMilestoneFile = vi.fn().mockResolvedValue(undefined);
    await createMilestoneValidator(async () => ({ validateMilestoneFile }))(file, index);
    expect(validateMilestoneFile).toHaveBeenCalledExactlyOnceWith(file, index);
  });
  it('preserves the shared validator error message', async () => {
    const validateMilestoneFile = vi.fn().mockRejectedValue(new Error('Final delivery must be an MP4 file.'));
    await expect(createMilestoneValidator(async () => ({ validateMilestoneFile }))(file, 2)).rejects.toThrow('Final delivery must be an MP4 file.');
  });
  it('does not silently accept a broken or unavailable module', async () => {
    await expect(createMilestoneValidator(async () => ({} as never))(file, 0)).rejects.toThrow('File checks are temporarily unavailable');
    await expect(createMilestoneValidator(async () => { throw new Error('Module unavailable.'); })(file, 0)).rejects.toThrow('Module unavailable.');
  });
});
