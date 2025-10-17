import { ApiProperty } from '@nestjs/swagger'
import { IsString, MinLength } from 'class-validator'

export class AuthLogoutCommandDto {
  @ApiProperty({ description: 'Refresh token do unieważnienia', minLength: 10 })
  @IsString()
  @MinLength(10)
  refreshToken!: string
}


