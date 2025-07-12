import * as z from 'zod'
import { UserRoleSchema } from '../../utils/index.js'

export const SolutionMemberSchema = z.object({
  // organizationId: z.uuid(),
  // solutionId: z.uuid(),
  // userId: z.uuid(),
  name: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  userRole: UserRoleSchema,
  groups: z.array(z.string()).optional(),
  // avatarUrl: z.string().optional(),
  // Audit
  // createdAt: z.string(),
  // createdBy: z.uuid(),
  updatedAt: z.string(),
  updatedBy: z.uuid()
})
