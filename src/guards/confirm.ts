import { z } from 'zod';

/** Guard fragment for data-destroying operations (reinstall, snapshot revert,
 *  terminate). Forces the LLM to set two explicit flags, surfacing the call in
 *  the model's reasoning; the backend `servers:destroy` scope is the real gate. */
export const destructiveConfirm = {
  confirm: z.literal(true).describe(
    'Must be exactly `true`. Confirms the user was shown what will happen and explicitly approved it.',
  ),
  iAcknowledgeDataLoss: z.literal(true).describe(
    'Must be exactly `true`. The operation permanently destroys data on the disk.',
  ),
};

/** Guard fragment for medium-risk operations (stop/reboot, password reset). */
export const mediumConfirm = {
  confirm: z.literal(true).describe(
    'Must be exactly `true`. This interrupts the running workload — confirm with the user first.',
  ),
};
