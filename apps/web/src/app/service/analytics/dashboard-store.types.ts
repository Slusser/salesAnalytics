import type {
  AnalyticsKpiResponseDto,
  AnalyticsTrendResponseDto,
  DailyOrdersAnalyticsItemDto,
} from '@shared/dtos/analytics.dto';

export type DashboardFilters = {
  dateFrom: string;
  dateTo: string;
  customerId?: string;
};

export type DashboardQueryParams = Partial<DashboardFilters> & {
  year?: number;
  month?: number;
};

export type KpiViewModelKey =
  | 'sumNet'
  | 'sumGross'
  | 'sumProfit'
  | 'ordersCount'
  | 'avgOrder'
  | 'avgMargin';

export type KpiViewModel = {
  key: KpiViewModelKey;
  label: string;
  value: string;
  tooltip?: string;
  isPositive?: boolean;
};

export type TrendPointViewModel = {
  period: string;
  year: number;
  month: number;
  valuePln: number | null;
  formattedValue: string;
  isActive: boolean;
};

export type MonthSelection = {
  year: number;
  month: number;
  label: string;
};

export type DailyPointViewModel = {
  date: string;
  day: number;
  netPln: number;
  grossPln: number;
  distributorPln: number;
  customerPln: number;
  profitPln: number;
  avgMarginPct: number;
  ordersCount: number;
  formattedNet: string;
  formattedGross: string;
  formattedDistributor: string;
  formattedCustomer: string;
  formattedProfit: string;
  formattedAvgMargin: string;
};

export type EmptyStateConfig = {
  title: string;
  description: string;
  actionLabel?: string;
};

export type DataState<T> = {
  data?: T;
  isLoading: boolean;
  error?: string | null;
};

export type ManualRefreshState = {
  lastRefreshedAt?: Date;
  isRefreshing: boolean;
  ttlMs: number;
  error?: string | null;
};

export type DashboardState = {
  filters: DashboardFilters;
  kpi: DataState<AnalyticsKpiResponseDto>;
  trend: DataState<AnalyticsTrendResponseDto>;
  daily: DataState<DailyOrdersAnalyticsItemDto[]>;
  activeMonth?: MonthSelection;
  lastRefreshedAt?: Date;
};

export type DashboardStoreSnapshot = {
  state: DashboardState;
  kpiViewModel: KpiViewModel[];
  trendViewModel: TrendPointViewModel[];
  dailyViewModel: DailyPointViewModel[];
};


