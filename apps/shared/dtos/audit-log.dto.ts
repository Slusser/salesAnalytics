import type { Tables } from "../../db/database.types"

import type { PaginatedResponse, JsonValue } from "./common.dto"

type AuditLogRow = Tables<"audit_log">

/**
 * Współdzielony DTO wpisu z tabeli `audit_log` wykorzystywany w API globalnym.
 */
export interface AuditLogEntryDto {
  id: AuditLogRow["id"]
  schemaName: AuditLogRow["schema_name"]
  tableName: AuditLogRow["table_name"]
  recordPk: AuditLogRow["record_pk"]
  operation: AuditLogRow["operation"]
  oldRow: JsonValue | null
  newRow: JsonValue | null
  actor: AuditLogRow["actor"]
  requestId: AuditLogRow["request_id"]
  occurredAt: AuditLogRow["occured_at"]
}

export interface ListAuditLogQuery {
  table?: string
  operation?: string
  userId?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

export type ListAuditLogResponse = PaginatedResponse<AuditLogEntryDto>

