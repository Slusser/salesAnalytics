import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Pobierz dane aplikacji' })
  @ApiResponse({ 
    status: 200, 
    description: 'Dane zostały pomyślnie pobrane',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Hello API'
        }
      }
    }
  })
  getData() {
    return this.appService.getData();
  }
}
