export interface CustomersQueryParamsVm {
  page: number
  limit: number
  search?: string
  includeInactive?: boolean
}

export interface CustomerRowVm {
  id: string
  name: string
  isActive: boolean
  deleted: boolean
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
}

export const CUSTOMERS_DEFAULT_PAGE = 1
export const CUSTOMERS_DEFAULT_LIMIT = 25
export const CUSTOMERS_MAX_SEARCH_LENGTH = 120
export const CUSTOMERS_LIMIT_OPTIONS = [10, 25, 50, 100] as number[]


