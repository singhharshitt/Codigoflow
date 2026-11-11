import { z } from 'zod';

export const DevOpsProjectPathSchema = z.object({
  projectPath: z.string().min(1).max(512),
});

export const ApprovalSchema = z.object({
  approve: z.literal(true),
  confirmedBy: z.string().min(1).max(120).optional(),
});
