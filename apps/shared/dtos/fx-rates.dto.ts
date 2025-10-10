import type { UUID } from "./common.dto"

export interface FxRateDto {
  date: string
  source: "nbp" | "override"
  rate: number
  fetchedAt: string
  overriddenBy?: UUID
}

export interface FxRateQuery {
  date?: string
}

export interface FxRateOverrideCommand {
  date: string
  rate: number
  comment?: string
}

