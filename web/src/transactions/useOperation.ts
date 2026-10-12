import { useSyncExternalStore } from 'react';
import { OperationController } from './engine';

/** One operation lock and public session journal for all routes in this browser tab. */
export const operationController = new OperationController();

export function useOperation(controller: OperationController = operationController) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  return {
    snapshot,
    run: controller.run,
    check: controller.check,
    clearResolved: controller.clearResolved,
  };
}
