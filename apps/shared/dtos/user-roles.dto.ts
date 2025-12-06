import type { Tables } from "../../db/database.types"

import type { PaginatedResponse, UUID } from "./common.dto"

type UserRoleRow = Tables<"user_roles">

/**
 * Rola użytkownika rozpoznawana przez API. Ograniczamy wartość z bazy
 * (`user_roles.role`) do dozwolonych ról biznesowych.
 */
export type AppRole = "owner" | "editor" | "viewer"

export type UserRoleValue = Extract<AppRole, UserRoleRow["role"]>

/**
 * Pojedyncze przypisanie roli bazujące na wierszu `user_roles`.
 */
export interface UserRoleAssignmentDto {
  userId: UserRoleRow["user_id"]
  role: string;
  grantedAt: UserRoleRow["granted_at"]
}

/**
 * Zredukowany profil użytkownika wykorzystywany w innych DTO (np. w zamówieniach).
 */
export interface UserSummaryDto {
  id: UUID
  displayName: string
}

/**
 * Model odpowiedzi logowania – tokeny i profil użytkownika z rolami.
 */
export interface AuthTokensDto {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface AuthenticatedUserDto extends UserSummaryDto {
  email: string
  roles: AppRole[]
}

export interface AuthLoginResponse extends AuthTokensDto {
  user: AuthenticatedUserDto
}

/**
 * Polecenie logowania – dane wejściowe do komendy obsługującej POST /auth/login.
 */
export interface AuthLoginCommand {
  email: string
  password: string
}

export interface AuthLogoutCommand {
  refreshToken: string
}

export interface AuthLogoutResponse {
  success: boolean
}

/**
 * Struktura użytkownika używana w panelu administracyjnym.
 */
export interface AdminUserDto extends AuthenticatedUserDto {
  roleAssignments?: UserRoleAssignmentDto[]
}

export type AdminListUsersResponse = PaginatedResponse<AdminUserDto>

export interface AdminCreateUserCommand {
  email: string
  displayName: string
  password: string
  roles: UserRoleValue[]
}

export interface AdminUpdateUserCommand {
  displayName?: string
  password?: string
}

export interface AdminReplaceUserRolesCommand {
  roles: UserRoleValue[]
}

export interface AdminDeleteUserResponse {
  id: UUID
  status: "deactivated"
}

