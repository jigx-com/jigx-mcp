import * as z from 'zod'
import { UserRoleSchema } from '../../utils/index.js'

export const OrganizationMemberSchema = z.object({
  // organizationId: z.uuid(),
  // userId: z.uuid(),
  // region: z.string(),
  name: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  // avatarUrl: z.string().optional(),
  userRole: UserRoleSchema,
  userStatus: z.string(),
  // Audit
  // createdAt: z.string(),
  // createdBy: z.uuid(),
  updatedAt: z.string(),
  updatedBy: z.uuid()
})
