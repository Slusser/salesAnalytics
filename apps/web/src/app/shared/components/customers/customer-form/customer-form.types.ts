export interface CustomerFormModel {
  name: string
  isActive: boolean
  comment: string
  defaultDistributorDiscountPct: number
}

export interface ServerValidationErrors {
  fieldErrors?: Partial<Record<'name' | 'isActive' | 'comment' | 'defaultDistributorDiscountPct', string>>
  generalError?: string
}


