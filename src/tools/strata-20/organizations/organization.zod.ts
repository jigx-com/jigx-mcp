import * as z from 'zod'

export const OrganizationSchema = z.object({
  organizationId: z.uuid(),
  name: z.string(),
  region: z.string(),
  // description: z.string().optional(),
  // url: z.url().optional(),

  locked: z.boolean().optional(),
  settings: z.looseObject({}).optional(),

  // Audit
  // createdAt: z.string(),
  // createdBy: z.uuid(),
  updatedAt: z.string(),
  updatedBy: z.uuid()
})
