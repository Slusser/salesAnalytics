import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../security/jwt-auth.guard';
import { RolesGuard } from '../../security/roles.guard';
import { AnalyticsOrdersService } from './analytics-orders.service';
import { AnalyticsService } from './analytics.service';
import { Roles } from '../../security/roles.decorator';
import { GetKpiAnalyticsQueryDto } from './dto/get-kpi-analytics-query.dto';
import { AnalyticsKpiResponseDto } from './dto/analytics-kpi-response.dto';
import { AnalyticsKpiMapper } from './mappers/analytics-kpi.mapper';
import { CurrentUser } from '../../security/current-user.decorator';
import type { CustomerMutatorContext } from '@shared/dtos/customers.dto';
import { AnalyticsTrendMapper } from './mappers/analytics-trend.mapper';
import { AnalyticsTrendQueryDto } from './dto/analytics-trend-query.dto';
import type { AnalyticsTrendResponseDto } from '@shared/dtos/analytics.dto';
import { AnalyticsTrendEntryResponseDto } from './dto/analytics-trend-entry-response.dto';
import { GetDailyOrdersAnalyticsQueryDto } from './dto/get-daily-orders-analytics-query.dto';
import { DailyOrdersAnalyticsItemDto } from './dto/daily-orders-analytics-item-response.dto';
import type { DailyOrdersAnalyticsCommand } from './models/daily.types';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly analyticsOrdersService: AnalyticsOrdersService
  ) {}

  @Get('kpi')
  @Roles('viewer', 'editor', 'owner')
  @ApiOperation({
    summary:
      'Zwraca podstawowe KPI sprzedaży (suma, liczba zamówień, średnia wartość).',
  })
  @ApiOkResponse({
    description: 'Agregaty KPI zostały obliczone poprawnie.',
    type: AnalyticsKpiResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Niepoprawne parametry zapytania.',
  })
  @ApiUnauthorizedResponse({
    description: 'Brak tokenu lub token nieprawidłowy.',
  })
  @ApiForbiddenResponse({
    description: 'Użytkownik nie ma dostępu do wskazanego zakresu danych.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Błąd podczas obliczania agregatów KPI.',
  })
  async getKpi(
    @Query() query: GetKpiAnalyticsQueryDto,
    @CurrentUser() currentUser: CustomerMutatorContext
  ): Promise<AnalyticsKpiResponseDto> {
    const serviceQuery = AnalyticsKpiMapper.toQuery(query, currentUser);
    const result = await this.analyticsService.getKpiAggregates(serviceQuery);

    return {
      sumNetPln: result.sumNetPln,
      ordersCount: result.ordersCount,
      avgOrderValue: result.avgOrderValue,
    };
  }

  @Get('trend')
  @Roles('viewer', 'editor', 'owner')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      'Zwraca miesięczny trend sprzedaży (suma total_net_pln) w zadanym zakresie dat.',
  })
  @ApiOkResponse({
    description: 'Trend został poprawnie obliczony.',
    type: AnalyticsTrendEntryResponseDto,
    isArray: true,
  })
  @ApiBadRequestResponse({
    description: 'Niepoprawne parametry zapytania lub zakres dat.',
  })
  @ApiUnauthorizedResponse({
    description: 'Brak tokenu lub token nieprawidłowy.',
  })
  @ApiForbiddenResponse({
    description: 'Użytkownik nie ma dostępu do wskazanego zakresu danych.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Błąd podczas pobierania trendu sprzedaży.',
  })
  async getTrend(
    @Query() query: AnalyticsTrendQueryDto,
    @CurrentUser() currentUser: CustomerMutatorContext
  ): Promise<AnalyticsTrendResponseDto> {
    const command = AnalyticsTrendMapper.toCommand(query, currentUser);
    return this.analyticsService.getTrend(command);
  }

  @Get('daily')
  @Roles('viewer', 'editor', 'owner')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      'Zwraca dzienny rozkład sprzedaży (suma total_net_pln i liczba zamówień) dla wskazanego miesiąca.',
  })
  @ApiOkResponse({
    description: 'Dzienny rozkład sprzedaży został przygotowany poprawnie.',
    type: DailyOrdersAnalyticsItemDto,
    isArray: true,
  })
  @ApiBadRequestResponse({
    description: 'Niepoprawne parametry zapytania lub zakres dat.',
  })
  @ApiUnauthorizedResponse({
    description: 'Brak tokenu lub token nieprawidłowy.',
  })
  @ApiForbiddenResponse({
    description: 'Użytkownik nie ma dostępu do wskazanego zakresu danych.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Błąd podczas pobierania dziennych danych sprzedaży.',
  })
  async getDailyBreakdown(
    @Query() query: GetDailyOrdersAnalyticsQueryDto,
    @CurrentUser() currentUser: CustomerMutatorContext
  ): Promise<DailyOrdersAnalyticsItemDto[]> {
    const year = Number(query.year);
    const month = Number(query.month);

    const command: DailyOrdersAnalyticsCommand = {
      year,
      month,
      customerId: query.customerId,
      requester: currentUser,
      customerScope: currentUser.customerIds,
    };

    return this.analyticsOrdersService.getDailyBreakdown(command);
  }
}


