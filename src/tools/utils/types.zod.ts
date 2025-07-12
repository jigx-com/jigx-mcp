import * as z from 'zod'

export const UserRoleSchema = z.enum(['OWNER', 'ADMIN', 'MAKER', 'USER', 'DENY'])

export const ContinuationTokenSchema = z.string().regex(/^[a-z]{3}-/)

export const RegionSchema = z.enum(['us-west-2', 'us-west-1', 'us-east-1', 'eu-central-1', 'ap-southeast-2'])
