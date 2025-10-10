import type { Json } from "../../db/database.types"

/**
 * Ogólny typ odpowiedzi stronicowanej, współdzielony przez listy DTO.
 */
export interface PaginatedResponse<TItem> {
  items: TItem[]
  total: number
  page: number
  limit: number
}

/**
 * Alias na typ JSON Supabase – ułatwia czytelność w DTO.
 */
export type JsonValue = Json

/**
 * Pomocniczy alias na wartości opcjonalne.
 */
export type Nullable<T> = T | null

/**
 * Alias na identyfikatory UUID (Supabase posługuje się tekstowym UUID).
 */
export type UUID = string

