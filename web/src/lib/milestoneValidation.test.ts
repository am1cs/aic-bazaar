import { describe, expect, it, vi } from 'vitest';
import { File as NodeFile } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMilestoneValidator, validateMilestoneFile as validatePublishedFile } from './milestoneValidation';

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

describe('published partner validator through the production loader', () => {
  it.each([[0, 'concept.svg', 'image/svg+xml'], [1, 'draft.mp4', 'video/mp4'], [2, 'final.mp4', 'video/mp4']] as const)('validates the genuine demo file for stage %s before hashing', async (index, name, type) => {
    const bytes = readFileSync(join(process.cwd(), 'public', 'demo', name));
    const file = new NodeFile([bytes], name, { type }) as unknown as File;
    await expect(validatePublishedFile(file, index)).resolves.toBeUndefined();
  });
  it.each([1, 2] as const)('rejects an image submitted as video stage %s through the real export', async index => {
    const bytes = readFileSync(join(process.cwd(), 'public', 'demo', 'concept.svg'));
    const file = new NodeFile([bytes], 'concept.svg', { type: 'image/svg+xml' }) as unknown as File;
    await expect(validatePublishedFile(file, index)).rejects.toThrow('requires an MP4 video');
  });
});
