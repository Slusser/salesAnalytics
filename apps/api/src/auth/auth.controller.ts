import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'

import type { AuthLoginResponse, AuthLogoutResponse } from 'apps/shared/dtos/user-roles.dto'

import { Public } from '../security/public.decorator'
import { AuthService } from './auth.service'
import { AuthLoginCommandDto, AuthLogoutCommandDto } from './dto'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logowanie użytkownika' })
  @ApiBody({ type: AuthLoginCommandDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Poprawne logowanie', type: Object })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Niepoprawne dane logowania' })
  async login(@Body() command: AuthLoginCommandDto): Promise<AuthLoginResponse> {
    return this.authService.login(command)
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Wylogowanie użytkownika' })
  @ApiBody({ type: AuthLogoutCommandDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Użytkownik wylogowany', type: Object })
  async logout(@Body() command: AuthLogoutCommandDto): Promise<AuthLogoutResponse> {
    return this.authService.logout(command)
  }
}


