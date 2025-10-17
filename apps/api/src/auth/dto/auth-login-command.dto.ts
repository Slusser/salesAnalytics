import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsString, MinLength } from 'class-validator'

export class AuthLoginCommandDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string

  @ApiProperty({ example: 'P@ssw0rd!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string
}


