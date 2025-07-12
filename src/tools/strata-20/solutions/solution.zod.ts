import * as z from 'zod'

export const SolutionSchema = z.object({
  // organizationId: z.uuid(),
  // solutionId: z.uuid(),
  // region: z.string(),
  name: z.string(),
  title: z.string(),
  description: z.string().optional(),
  category: z.string(),
  locked: z.boolean().optional(),
  jacl: z.object().optional(),
  groups: z.array(z.string()).optional(),
  // Audit
  // createdAt: z.string(),
  // createdBy: z.uuid(),
  updatedAt: z.string(),
  updatedBy: z.uuid()
})
