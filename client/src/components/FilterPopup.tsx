import { useState, useEffect } from "react";
import { Calendar, X, ChevronDown, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import apiService from "@/services/api";
import { useLocation } from "react-router-dom";

interface FilterPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyFilters: (filters: any) => void;
  resetTrigger?: number;
}

interface FilterOptions {
  Status: string[];
  CallType: string[];
  Sentiment: string[];
  Trunk: string[];
}

export function FilterPopup({ open, onOpenChange, onApplyFilters, resetTrigger }: FilterPopupProps) {
  const location = useLocation();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({
    Status: [],
    CallType: [],
    Sentiment: [],
    Trunk: [],
  });
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    Status: [],
    CallType: [],
    Sentiment: [],
    Trunk: [],
  });
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Determine API endpoint based on current route
  const getApiEndpoint = (): 'inbound-calls' | 'outgoing-calls' | 'call-logs' => {
    if (location.pathname === '/call-logs/incoming') return 'inbound-calls';
    if (location.pathname === '/call-logs/outgoing') return 'outgoing-calls';
    if (location.pathname === '/call-logs') return 'call-logs';
    return 'inbound-calls'; // default
  };

  // Load filter options from API
  const loadFilterOptions = async () => {
    setLoadingOptions(true);
    const endpoint = getApiEndpoint();
    
    try {
      const [statusOptions, callTypeOptions, sentimentOptions, trunkOptions] = await Promise.all([
        apiService.fetchFilterOptions('Status', endpoint),
        apiService.fetchFilterOptions('CallType', endpoint),
        apiService.fetchFilterOptions('Sentiment', endpoint),
        apiService.fetchFilterOptions('Trunk', endpoint),
      ]);

      setFilterOptions({
        Status: statusOptions,
        CallType: callTypeOptions,
        Sentiment: sentimentOptions,
        Trunk: trunkOptions,
      });
    } catch (error) {
      console.error('Error loading filter options:', error);
    } finally {
      setLoadingOptions(false);
    }
  };

  // Load filter options when popup opens or route changes
  useEffect(() => {
    if (open) {
      loadFilterOptions();
    }
  }, [open, location.pathname]);

  // Reset filter state when resetTrigger changes (route change)
  useEffect(() => {
    if (resetTrigger !== undefined) {
      console.log('[FILTER-POPUP] Resetting filter state due to route change');
      setDateFrom("");
      setDateTo("");
      setSelectedPreset(null);
      setColumnFilters({
        Status: [],
        CallType: [],
        Sentiment: [],
        Trunk: [],
      });
    }
  }, [resetTrigger]);

  const datePresets = [
    { label: "Today", value: "today" },
    { label: "Last 7 Days", value: "last7days" },
    { label: "This Month", value: "thismonth" },
    { label: "Last Month", value: "lastmonth" },
    { label: "Last 30 Days", value: "last30days" },
    { label: "Last 90 Days", value: "last90days" },
  ];

  const handlePresetClick = (preset: string) => {
    setSelectedPreset(preset);
    // Calculate dates based on preset
    const today = new Date();
    let from = new Date();
    let to = new Date();

    switch (preset) {
      case "today":
        from = new Date(today);
        to = new Date(today);
        break;
      case "last7days":
        from = new Date(today.setDate(today.getDate() - 7));
        to = new Date();
        break;
      case "thismonth":
        from = new Date(today.getFullYear(), today.getMonth(), 1);
        to = new Date();
        break;
      case "lastmonth":
        from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        to = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case "last30days":
        from = new Date(today.setDate(today.getDate() - 30));
        to = new Date();
        break;
      case "last90days":
        from = new Date(today.setDate(today.getDate() - 90));
        to = new Date();
        break;
    }

    setDateFrom(from.toISOString().split('T')[0]);
    setDateTo(to.toISOString().split('T')[0]);
  };

  const handleColumnFilterChange = (column: string, value: string, checked: boolean) => {
    setColumnFilters(prev => ({
      ...prev,
      [column]: checked 
        ? [...prev[column], value]
        : prev[column].filter(v => v !== value)
    }));
  };

  const handleApply = () => {
    // Convert multi-select arrays to MongoDB query format
    const processedFilters: any = {
      dateFrom,
      dateTo,
      preset: selectedPreset,
      columns: {}
    };

    // Add column filters only if they have values
    Object.entries(columnFilters).forEach(([key, values]) => {
      if (values.length > 0) {
        // For MongoDB queries, we need to use $in operator for multiple values
        processedFilters.columns[key] = values.length === 1 ? values[0] : { $in: values };
      }
    });

    console.log('[FILTER-POPUP] Applying filters:', processedFilters);
    onApplyFilters(processedFilters);
    onOpenChange(false);
  };

  const handleClear = () => {
    setDateFrom("");
    setDateTo("");
    setSelectedPreset(null);
    setColumnFilters({
      Status: [],
      CallType: [],
      Sentiment: [],
      Trunk: [],
    });
  };

  const activeFiltersCount = 
    (dateFrom || dateTo || selectedPreset ? 1 : 0) +
    Object.values(columnFilters).reduce((acc, values) => acc + values.length, 0);

  // Multi-select dropdown component
  const MultiSelectDropdown = ({ 
    field, 
    options, 
    selectedValues, 
    onSelectionChange 
  }: { 
    field: string; 
    options: string[]; 
    selectedValues: string[]; 
    onSelectionChange: (field: string, value: string, checked: boolean) => void;
  }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={isOpen}
            className="w-full justify-between h-10"
          >
            <span className="truncate">
              {selectedValues.length === 0
                ? `Select ${field}...`
                : selectedValues.length === 1
                ? selectedValues[0]
                : `${selectedValues.length} selected`}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <ScrollArea className="h-60">
            <div className="p-2">
              {loadingOptions ? (
                <div className="p-2 text-sm text-muted-foreground">Loading options...</div>
              ) : options.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground">No options available</div>
              ) : (
                options.map((option) => (
                  <div
                    key={option}
                    className="flex items-center space-x-2 p-2 hover:bg-accent rounded-sm cursor-pointer"
                    onClick={() => {
                      const isSelected = selectedValues.includes(option);
                      onSelectionChange(field, option, !isSelected);
                    }}
                  >
                    <Checkbox
                      checked={selectedValues.includes(option)}
                      onChange={() => {}} // Handled by parent onClick
                    />
                    <span className="text-sm flex-1">{option}</span>
                    {selectedValues.includes(option) && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFiltersCount} active
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="date" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="date">Date Range</TabsTrigger>
            <TabsTrigger value="columns">Column Filters</TabsTrigger>
          </TabsList>

          <TabsContent value="date" className="space-y-4">
            {/* Date Presets */}
            <div className="space-y-2">
              <Label>Quick Select</Label>
              <div className="grid grid-cols-3 gap-2">
                {datePresets.map((preset) => (
                  <Button
                    key={preset.value}
                    variant={selectedPreset === preset.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePresetClick(preset.value)}
                    className="text-xs"
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date-from">From Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setSelectedPreset(null);
                    }}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date-to">To Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="date-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setSelectedPreset(null);
                    }}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="columns" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <MultiSelectDropdown
                  field="Status"
                  options={filterOptions.Status}
                  selectedValues={columnFilters.Status}
                  onSelectionChange={handleColumnFilterChange}
                />
                {columnFilters.Status.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {columnFilters.Status.map((value) => (
                      <Badge key={value} variant="secondary" className="text-xs">
                        {value}
                        <X 
                          className="ml-1 h-3 w-3 cursor-pointer" 
                          onClick={() => handleColumnFilterChange("Status", value, false)}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Call Type</Label>
                <MultiSelectDropdown
                  field="CallType"
                  options={filterOptions.CallType}
                  selectedValues={columnFilters.CallType}
                  onSelectionChange={handleColumnFilterChange}
                />
                {columnFilters.CallType.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {columnFilters.CallType.map((value) => (
                      <Badge key={value} variant="secondary" className="text-xs">
                        {value}
                        <X 
                          className="ml-1 h-3 w-3 cursor-pointer" 
                          onClick={() => handleColumnFilterChange("CallType", value, false)}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Sentiment</Label>
                <MultiSelectDropdown
                  field="Sentiment"
                  options={filterOptions.Sentiment}
                  selectedValues={columnFilters.Sentiment}
                  onSelectionChange={handleColumnFilterChange}
                />
                {columnFilters.Sentiment.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {columnFilters.Sentiment.map((value) => (
                      <Badge key={value} variant="secondary" className="text-xs">
                        {value}
                        <X 
                          className="ml-1 h-3 w-3 cursor-pointer" 
                          onClick={() => handleColumnFilterChange("Sentiment", value, false)}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Trunk</Label>
                <MultiSelectDropdown
                  field="Trunk"
                  options={filterOptions.Trunk}
                  selectedValues={columnFilters.Trunk}
                  onSelectionChange={handleColumnFilterChange}
                />
                {columnFilters.Trunk.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {columnFilters.Trunk.map((value) => (
                      <Badge key={value} variant="secondary" className="text-xs">
                        {value}
                        <X 
                          className="ml-1 h-3 w-3 cursor-pointer" 
                          onClick={() => handleColumnFilterChange("Trunk", value, false)}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={handleClear}>
            Clear All
          </Button>
          <div className="space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleApply}>
              Apply Filters
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}