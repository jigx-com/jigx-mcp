import * as z from 'zod'

export const DataRowSchema = z.object({
  // organizationId: z.uuid(),
  // solutionId: z.uuid(),
  // tableId: z.string(),
  rid: z.string(),
  data: z.record(z.string(), z.unknown()),
  // Audit
  // createdAt: z.string(),
  // createdBy: z.uuid(),
  updatedAt: z.string(),
  updatedBy: z.uuid()
  // version: z.number()
})
