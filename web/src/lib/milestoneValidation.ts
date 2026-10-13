import type { MilestoneIndex } from '../../../shared/api';

type Validator = (file: File, index: MilestoneIndex) => Promise<void>;
type MediaModule = { validateMilestoneFile: Validator };
type Loader = () => Promise<MediaModule>;
const unavailable = 'File checks are temporarily unavailable. Please try again after the site is updated. No material was submitted.';

/** Integration only: the partner's media.ts owns all format checks. */
export function createMilestoneValidator(load?: Loader): Validator {
  return async (file, index) => {
    if (!load) throw new Error(unavailable);
    const media = await load();
    if (typeof media.validateMilestoneFile !== 'function') throw new Error(unavailable);
    await media.validateMilestoneFile(file, index);
  };
}

// An absent partner module must fail before hashing or signing, not bypass checks.
const modules = import.meta.glob<MediaModule>('./media.ts');
export const validateMilestoneFile = createMilestoneValidator(modules['./media.ts']);
