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

// The agreed partner module is now published. A direct import makes its presence
// a build requirement; no format check is duplicated or bypassed here.
export const validateMilestoneFile = createMilestoneValidator(() => import('./media'));
