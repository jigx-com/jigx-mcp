import * as z from 'zod'

export const UserSchema = z.object({
  userId: z.uuid(),
  name: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),

  avatarUrl: z.string().optional(),
  defaultOrganizationId: z.uuid().optional(),
  status: z.string().optional(),

  statistics: z.looseObject({}),
  organizations: z.looseObject({}).optional(), // Racl

  // Audit
  // createdAt: z.string(),
  // createdBy: z.uuid(),
  updatedAt: z.string(),
  updatedBy: z.uuid()
})
