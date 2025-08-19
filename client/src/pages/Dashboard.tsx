import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { debounce } from 'lodash';
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPhone,
  faCheckCircle,
  faClock,
  faDollarSign,
  faPhoneFlip,
  faArrowUp,
  faMap,
  faStopwatch
} from '@fortawesome/free-solid-svg-icons';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "../components/ui/chart";

// Animated Number Component with improved visibility
const AnimatedNumber = ({ value, duration = 2000, formatFn = (n: number) => n.toString() }: {
  value: number;
  duration?: number;
  formatFn?: (n: number) => string;
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    // Skip animation if value is 0
    if (value === 0) {
      setDisplayValue(0);
      setIsAnimating(false);
      return;
    }

    // Animate when value changes or on first load
    if (value !== displayValue || !hasInitialized) {
      setIsAnimating(true);
      setHasInitialized(true);
      
      const startTime = Date.now();
      const startValue = !hasInitialized ? 0 : displayValue; // Start from 0 on first load
      const endValue = value;

      const animate = () => {
        const currentTime = Date.now();
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation (ease-out-cubic)
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        const currentValue = startValue + ((endValue - startValue) * easeOutCubic);
        
        setDisplayValue(currentValue);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setDisplayValue(endValue);
          setIsAnimating(false);
        }
      };

      // Small delay to ensure component is mounted
      setTimeout(() => {
        requestAnimationFrame(animate);
      }, 100);
    }
  }, [value]);

  return (
    <span className={`inline-block transition-all duration-300 ${isAnimating ? 'text-blue-600 scale-105' : 'text-gray-700'}`}>
      {formatFn(Math.round(displayValue))}
    </span>
  );
};

// Types
interface CallLog {
  _id: string;
  CallTime: string;
  CallerID: string;
  AreaCode: string;
  CallType: 'Incoming' | 'Outgoing';
  Status: 'Answered' | 'Unanswered';
  Trunk: string;
  TrunkNumber: string;
  Ringing: string;
  Talking: string;
  TotalDuration: string;
  Cost: string;
  Sentiment: string;
  Summary: string;
  Transcription: string;
  source: 'incoming' | 'outgoing';
}

interface ApiResponse {
  success: boolean;
  data: CallLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  incomingCount: number;
  outgoingCount: number;
}

interface TrendCardProps {
  title: string;
  value: string;
  change: string;
  changeType: "positive" | "neutral" | "negative";
  trendType: "up" | "neutral" | "down";
  icon?: any;
}

interface FilterState {
  dateRange: string;
  customStartDate: string;
  customEndDate: string;
  status: string;
  callType: string;
  trunkNumber: string;
  areaCode: string;
}

interface AreaCodeData {
  areaCode: string;
  count: number;
  percentage: number;
}

// Utility functions
const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(3)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(3)}K`;
  return num.toString();
};

const formatDuration = (duration: string): number => {
  if (!duration) return 0;
  const parts = duration.split(':');
  if (parts.length !== 3) return 0;
  const hours = parseInt(parts[0]) || 0;
  const minutes = parseInt(parts[1]) || 0;
  const seconds = parseInt(parts[2]) || 0;
  return hours * 60 + minutes + seconds / 60;
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// TrendCard Component
const TrendCard = ({ title, value, change, changeType, trendType, icon, numericValue = 0 }: TrendCardProps & { numericValue?: number }) => {
  const getChangeColor = () => {
    switch (changeType) {
      case 'positive': return 'text-green-600 bg-green-50';
      case 'negative': return 'text-red-600 bg-red-50';
      default: return 'text-yellow-600 bg-yellow-50';
    }
  };

  const getTrendIcon = () => {
    switch (trendType) {
      case 'up': return '↗';
      case 'down': return '↘';
      default: return '→';
    }
  };

  // Custom format function based on the title
  const getFormatFunction = () => {
    if (title === "Total Calls" || title === "Incoming Calls" || title === "Outgoing Calls") {
      return (n: number) => formatNumber(n);
    } else if (title === "Answered Calls") {
      return (n: number) => `${n.toFixed(1)}%`;
    } else if (title === "Talk Time") {
      return (n: number) => `${n}m`;
    } else if (title === "Total Cost") {
      return (n: number) => formatCurrency(n);
    } else if (title === "Area Codes") {
      return (n: number) => n.toString();
    } else if (title === "Avg Duration") {
      return (n: number) => `${n.toFixed(1)}m`;
    }
    return (n: number) => n.toString();
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 relative hover:shadow-md transition-shadow">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
          {icon && <FontAwesomeIcon icon={icon} className="text-lg" />}
          {title}
        </div>
        <div className="text-2xl font-semibold text-gray-700">
          <AnimatedNumber
            value={numericValue}
            duration={1500}
            formatFn={getFormatFunction()}
          />
        </div>
      </div>
      <div className={`absolute top-4 right-4 px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 ${getChangeColor()}`}>
        <span>{getTrendIcon()}</span>
        {change}
      </div>
    </div>
  );
};

// Area Code Bar Chart Component
const AreaCodeBarChart = ({ data }: { data: AreaCodeData[] }) => {
  const [activeChart, setActiveChart] = useState<"totalCalls">("totalCalls");

  // Transform data for the bar chart - take top 15 area codes
  const chartData = data.slice(0, 15).map(item => ({
    areaCode: item.areaCode || 'Unknown',
    totalCalls: item.count,
  }));

  const chartConfig = {
    totalCalls: {
      label: "Total Calls",
      color: "hsl(var(--chart-1))",
    },
  } satisfies ChartConfig;

  const total = React.useMemo(
    () => ({
      totalCalls: chartData.reduce((acc, curr) => acc + curr.totalCalls, 0),
    }),
    [chartData]
  );

  return (
    <Card className="py-0">
      <CardHeader className="flex flex-col items-stretch border-b !p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 pt-4 pb-3 sm:!py-6">
          <CardTitle>Area Code Distribution</CardTitle>
          <CardDescription>
            Showing call volume by area code (Top 15)
          </CardDescription>
        </div>
        <div className="flex">
          <button
            data-active={activeChart === "totalCalls"}
            className="data-[active=true]:bg-muted/50 relative z-30 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left sm:border-t-0 sm:px-8 sm:py-6"
            onClick={() => setActiveChart("totalCalls")}
          >
            <span className="text-muted-foreground text-xs">
              {chartConfig.totalCalls.label}
            </span>
            <span className="text-lg leading-none font-bold sm:text-3xl">
              {total.totalCalls.toLocaleString()}
            </span>
          </button>
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:p-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[300px] w-full"
        >
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="areaCode"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="w-[150px]"
                  nameKey="totalCalls"
                  labelFormatter={(value) => `Area Code: ${value}`}
                />
              }
            />
            <Bar
              dataKey={activeChart}
              fill={`var(--color-${activeChart})`}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};


// Main Dashboard Component
const Dashboard: React.FC = () => {
  const [data, setData] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    dateRange: 'all', // Default to "All Time" to show all 42,787 records
    customStartDate: '',
    customEndDate: '',
    status: '',
    callType: '',
    trunkNumber: '',
    areaCode: '',
  });

  // Filter options state
  const [filterOptions, setFilterOptions] = useState({
    statuses: [] as string[],
    callTypes: [] as string[],
    trunkNumbers: [] as string[],
    areaCodes: [] as string[],
  });

  // Fetch filter options
  const fetchFilterOptions = useCallback(async () => {
    try {
      const response = await fetch('/api/call-logs?page=1&pageSize=1');
      if (!response.ok) throw new Error('Failed to fetch filter options');
      
      const result: ApiResponse = await response.json();
      
      // Get unique values for filters
      const allDataResponse = await fetch('/api/call-logs?page=1&pageSize=5000');
      const allData: ApiResponse = await allDataResponse.json();
      
      if (allData.data) {
        const statuses = [...new Set(allData.data.map(item => item.Status).filter(Boolean))];
        const callTypes = [...new Set(allData.data.map(item => item.CallType).filter(Boolean))];
        const trunkNumbers = [...new Set(allData.data.map(item => item.TrunkNumber).filter(Boolean))];
        const areaCodes = [...new Set(allData.data.map(item => item.AreaCode).filter(Boolean))];
        
        setFilterOptions({
          statuses: statuses.sort(),
          callTypes: callTypes.sort(),
          trunkNumbers: trunkNumbers.sort(),
          areaCodes: areaCodes.sort(),
        });
      }
    } catch (err) {
      console.error('Failed to fetch filter options:', err);
    }
  }, []);


  // Store API response totals
  const [apiTotals, setApiTotals] = useState({
    total: 0,
    incomingCount: 0,
    outgoingCount: 0,
  });

  // Modified debounced API call to store totals
  const debouncedFetchDataWithTotals = useCallback(
    debounce(async (currentFilters: FilterState) => {
      try {
        console.log('[DEBUG-FRONTEND] ========== API CALL START ==========');
        console.log('[DEBUG-FRONTEND] Filters:', JSON.stringify(currentFilters, null, 2));
        console.log('[DEBUG-FRONTEND] Current loading state:', loading);
        
        setLoading(true);
        const params = new URLSearchParams({
          page: '1',
          pageSize: '1000', // Reasonable size for dashboard metrics
          sortBy: 'CallTime',
          sortOrder: 'DESC',
        });

        // Add date range filtering
        if (currentFilters.dateRange === 'custom' && currentFilters.customStartDate && currentFilters.customEndDate) {
          params.append('startDate', currentFilters.customStartDate);
          params.append('endDate', currentFilters.customEndDate);
          console.log('[DEBUG-FRONTEND] Using custom date range:', currentFilters.customStartDate, 'to', currentFilters.customEndDate);
        } else if (currentFilters.dateRange !== 'all') {
          params.append('dateRange', currentFilters.dateRange);
          console.log('[DEBUG-FRONTEND] Using predefined date range:', currentFilters.dateRange);
          console.log('[DEBUG-FRONTEND] Expected counts - today: 395, last30days: 32,927, last90days: 42,786, all: 42,787');
        } else {
          console.log('[DEBUG-FRONTEND] Using "All Time" - no date filtering, expecting 42,787 records');
        }

        // Add other filters
        if (currentFilters.status) {
          params.append('status', currentFilters.status);
        }
        if (currentFilters.callType) {
          params.append('callType', currentFilters.callType);
        }
        if (currentFilters.trunkNumber) {
          params.append('trunkNumber', currentFilters.trunkNumber);
        }
        if (currentFilters.areaCode) {
          params.append('areaCode', currentFilters.areaCode);
        }

        const apiUrl = `/api/call-logs?${params}`;
        console.log('[DEBUG-FRONTEND] Full API URL:', apiUrl);
        console.log('[DEBUG-FRONTEND] Request timestamp:', new Date().toISOString());
        
        const response = await fetch(apiUrl);
        console.log('[DEBUG-FRONTEND] Response status:', response.status);
        
        if (!response.ok) throw new Error('Failed to fetch data');
        
        const result: ApiResponse = await response.json();
        console.log('[DEBUG-FRONTEND] ========== API RESPONSE ==========');
        console.log('[DEBUG-FRONTEND] Response received at:', new Date().toISOString());
        console.log('[DEBUG-FRONTEND] Response details:', {
          success: result.success,
          dataLength: result.data?.length || 0,
          total: result.total,
          incomingCount: result.incomingCount,
          outgoingCount: result.outgoingCount,
          expectedTotal: currentFilters.dateRange === 'all' ? 42787 :
                        currentFilters.dateRange === 'today' ? 395 :
                        currentFilters.dateRange === 'last30days' ? 32927 :
                        currentFilters.dateRange === 'last90days' ? 42786 : 'unknown',
          isCorrect: currentFilters.dateRange === 'all' ? result.total === 42787 :
                    currentFilters.dateRange === 'today' ? result.total === 395 :
                    currentFilters.dateRange === 'last30days' ? result.total === 32927 :
                    currentFilters.dateRange === 'last90days' ? result.total === 42786 : 'N/A'
        });
        
        if (currentFilters.dateRange !== 'all' && result.total === 42787) {
          console.error('[DEBUG-FRONTEND] ❌ ERROR: Date filter not working! Getting all records instead of filtered.');
        }
        
        // Store the totals from API
        setApiTotals({
          total: result.total || 0,
          incomingCount: result.incomingCount || 0,
          outgoingCount: result.outgoingCount || 0,
        });
        
        setData(result.data || []);
        setError(null);
        console.log('[DEBUG-FRONTEND] Data and totals updated successfully');
      } catch (err) {
        console.error('[DEBUG-FRONTEND] ❌ API call failed:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
        setData([]);
        setApiTotals({ total: 0, incomingCount: 0, outgoingCount: 0 });
      } finally {
        console.log('[DEBUG-FRONTEND] Setting loading to false - animation should start now');
        console.log('[DEBUG-FRONTEND] ========== API CALL END ==========');
        setLoading(false);
      }
    }, 300),
    []
  );

  // Fetch data on component mount and filter changes
  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);

  useEffect(() => {
    debouncedFetchDataWithTotals(filters);
    return () => debouncedFetchDataWithTotals.cancel();
  }, [filters, debouncedFetchDataWithTotals]);

  // Calculate metrics using API totals for counts
  const metrics = useMemo(() => {
    console.log('[DEBUG-FRONTEND] ========== METRICS CALCULATION ==========');
    console.log('[DEBUG-FRONTEND] Loading state:', loading);
    console.log('[DEBUG-FRONTEND] API totals:', apiTotals);
    console.log('[DEBUG-FRONTEND] Data length:', data.length);
    
    // Use API totals for accurate counts
    const totalCalls = apiTotals.total;
    const incomingCalls = apiTotals.incomingCount;
    const outgoingCalls = apiTotals.outgoingCount;
    
    console.log('[DEBUG-FRONTEND] Metrics values:', {
      totalCalls,
      incomingCalls,
      outgoingCalls,
      isLoading: loading
    });
    
    // Calculate other metrics from the sample data
    if (!data.length) {
      console.log('[DEBUG-FRONTEND] No data available - returning zeros for calculated metrics');
      return {
        totalCalls,
        answeredCalls: 0,
        answerRate: 0,
        totalMinutes: 0,
        totalCost: 0,
        uniqueAreaCodes: 0,
        incomingCalls,
        outgoingCalls,
        areaCodeData: [] as AreaCodeData[],
      };
    }

    // Calculate answer rate from sample
    const answeredInSample = data.filter(call => call.Status === 'Answered').length;
    const answerRate = data.length > 0 ? (answeredInSample / data.length) * 100 : 0;
    
    // Estimate total answered calls based on sample rate
    const answeredCalls = Math.round((answerRate / 100) * totalCalls);
    
    // Calculate average minutes and cost from sample, then extrapolate
    const sampleMinutes = data.reduce((sum, call) => {
      return sum + formatDuration(call.Talking || '00:00:00');
    }, 0);
    const avgMinutesPerCall = data.length > 0 ? sampleMinutes / data.length : 0;
    const totalMinutes = Math.round(avgMinutesPerCall * totalCalls);

    const sampleCost = data.reduce((sum, call) => {
      const cost = parseFloat(call.Cost || '0');
      return sum + (isNaN(cost) ? 0 : cost);
    }, 0);
    const avgCostPerCall = data.length > 0 ? sampleCost / data.length : 0;
    const totalCost = avgCostPerCall * totalCalls;

    // Calculate area code distribution from sample
    const areaCodeCounts = data.reduce((acc, call) => {
      const areaCode = call.AreaCode || 'Unknown';
      acc[areaCode] = (acc[areaCode] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const areaCodeData: AreaCodeData[] = Object.entries(areaCodeCounts)
      .map(([areaCode, count]) => ({
        areaCode,
        count: Math.round((count / data.length) * totalCalls), // Extrapolate to total
        percentage: (count / data.length) * 100,
      }))
      .sort((a, b) => b.count - a.count);

    const uniqueAreaCodes = areaCodeData.length;

    const calculatedMetrics = {
      totalCalls,
      answeredCalls,
      answerRate,
      totalMinutes,
      totalCost,
      uniqueAreaCodes,
      incomingCalls,
      outgoingCalls,
      areaCodeData,
    };
    
    console.log('[DEBUG-FRONTEND] Calculated metrics:', calculatedMetrics);
    return calculatedMetrics;
  }, [data, apiTotals]);

  // Generate trend cards data
  const trendCardsData: TrendCardProps[] = [
    {
      title: "Total Calls",
      value: formatNumber(metrics.totalCalls),
      change: "12.8%",
      changeType: "positive",
      trendType: "up",
      icon: faPhone,
    },
    {
      title: "Answered Calls",
      value: `${metrics.answerRate.toFixed(1)}%`,
      change: "2.4%",
      changeType: "positive",
      trendType: "up",
      icon: faCheckCircle,
    },
    {
      title: "Talk Time",
      value: `${Math.round(metrics.totalMinutes)}m`,
      change: "5.7%",
      changeType: "negative",
      trendType: "down",
      icon: faClock,
    },
    {
      title: "Total Cost",
      value: formatCurrency(metrics.totalCost),
      change: "8.3%",
      changeType: "positive",
      trendType: "up",
      icon: faDollarSign,
    },
    {
      title: "Incoming Calls",
      value: formatNumber(metrics.incomingCalls),
      change: "15.2%",
      changeType: "positive",
      trendType: "up",
      icon: faPhoneFlip,
    },
    {
      title: "Outgoing Calls",
      value: formatNumber(metrics.outgoingCalls),
      change: "18.3%",
      changeType: "negative",
      trendType: "up",
      icon: faArrowUp,
    },
    {
      title: "Area Codes",
      value: metrics.uniqueAreaCodes.toString(),
      change: "4.7%",
      changeType: "positive",
      trendType: "up",
      icon: faMap,
    },
    {
      title: "Avg Duration",
      value: `${(metrics.totalMinutes / Math.max(metrics.totalCalls, 1)).toFixed(1)}m`,
      change: "1.2%",
      changeType: "neutral",
      trendType: "neutral",
      icon: faStopwatch,
    },
  ];

  // Reset filters
  const resetFilters = () => {
    setFilters({
      dateRange: 'all',
      customStartDate: '',
      customEndDate: '',
      status: '',
      callType: '',
      trunkNumber: '',
      areaCode: '',
    });
  };

  // Don't show skeleton loading - render the dashboard with animated numbers
  console.log('[DEBUG-FRONTEND] ========== RENDER ==========');
  console.log('[DEBUG-FRONTEND] Current loading state:', loading);
  console.log('[DEBUG-FRONTEND] Current metrics:', {
    totalCalls: metrics.totalCalls,
    incomingCalls: metrics.incomingCalls,
    outgoingCalls: metrics.outgoingCalls
  });

  if (error) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">3CX Analytics Dashboard</h1>
          <p className="text-gray-600">Real-time insights from your call data</p>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Error Loading Data</h3>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">3CX Analytics Dashboard</h1>
        <p className="text-gray-600">Real-time insights from your call data</p>
      </div>

      {/* Enhanced Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* Date Range Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Date Range</label>
            <select
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm cursor-pointer"
              value={filters.dateRange}
              onChange={(e) => {
                console.log('[DEBUG-FRONTEND] Date range changed to:', e.target.value);
                setFilters(prev => ({ ...prev, dateRange: e.target.value }));
              }}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7days">Last 7 Days</option>
              <option value="last30days">Last 30 Days</option>
              <option value="last90days">Last 90 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Status</label>
            <select
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            >
              <option value="">All Statuses</option>
              {filterOptions.statuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          {/* Call Type Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Call Type</label>
            <select
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
              value={filters.callType}
              onChange={(e) => setFilters(prev => ({ ...prev, callType: e.target.value }))}
            >
              <option value="">All Types</option>
              {filterOptions.callTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Trunk Number Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Trunk Number</label>
            <select
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
              value={filters.trunkNumber}
              onChange={(e) => setFilters(prev => ({ ...prev, trunkNumber: e.target.value }))}
            >
              <option value="">All Trunks</option>
              {filterOptions.trunkNumbers.map(trunk => (
                <option key={trunk} value={trunk}>{trunk}</option>
              ))}
            </select>
          </div>

          {/* Area Code Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Area Code</label>
            <select
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
              value={filters.areaCode}
              onChange={(e) => setFilters(prev => ({ ...prev, areaCode: e.target.value }))}
            >
              <option value="">All Area Codes</option>
              {filterOptions.areaCodes.map(code => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </div>

          {/* Reset Button */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">&nbsp;</label>
            <button 
              onClick={resetFilters}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors bg-white text-sm font-medium"
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* Custom Date Range Inputs */}
        {filters.dateRange === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Start Date</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                value={filters.customStartDate}
                onChange={(e) => setFilters(prev => ({ ...prev, customStartDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">End Date</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                value={filters.customEndDate}
                onChange={(e) => setFilters(prev => ({ ...prev, customEndDate: e.target.value }))}
              />
            </div>
          </div>
        )}
      </div>

      {/* Trend Cards */}
      <div className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {trendCardsData.map((props, index) => {
          // Extract numeric values for animation
          let numericValue = 0;
          if (props.title === "Total Calls") {
            numericValue = metrics.totalCalls;
          } else if (props.title === "Answered Calls") {
            numericValue = metrics.answerRate;
          } else if (props.title === "Talk Time") {
            numericValue = Math.round(metrics.totalMinutes);
          } else if (props.title === "Total Cost") {
            numericValue = metrics.totalCost;
          } else if (props.title === "Incoming Calls") {
            numericValue = metrics.incomingCalls;
          } else if (props.title === "Outgoing Calls") {
            numericValue = metrics.outgoingCalls;
          } else if (props.title === "Area Codes") {
            numericValue = metrics.uniqueAreaCodes;
          } else if (props.title === "Avg Duration") {
            numericValue = metrics.totalMinutes / Math.max(metrics.totalCalls, 1);
          }

          console.log(`[DEBUG-FRONTEND] TrendCard ${props.title}: value=${numericValue}, loading=${loading}`);

          return (
            <TrendCard
              key={index}
              {...props}
              numericValue={numericValue}
            />
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <AreaCodeBarChart data={metrics.areaCodeData} />
      </div>
    </div>
  );
};

export default Dashboard;