export interface CustomerFormModel {
  name: string
  isActive: boolean
  comment: string
}

export interface ServerValidationErrors {
  fieldErrors?: Partial<Record<'name' | 'isActive' | 'comment', string>>
  generalError?: string
}


