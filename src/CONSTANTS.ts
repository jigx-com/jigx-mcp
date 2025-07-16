export const API_BASE_URL = 'https://us-west-2.dev-api.jigx.com'

export const API_VERSIONS = {
  STRATA_V20: 'v2.0/strata',
  DATA_V20: 'v2.0/data',
  TOOL_V20: 'v2.0/tool'
} as const

export const API_ENDPOINTS = {
  ORGANIZATIONS: '/organizations',
  SOLUTIONS: '/solutions',
  USERS: '/users'
} as const
