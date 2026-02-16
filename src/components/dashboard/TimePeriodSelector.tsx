import { useState } from "react";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { it, enUS } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRange } from "@/hooks/useTimeFilteredData";
import { useLanguage } from "@/contexts/LanguageContext";

export type TimePeriod = "today" | "week" | "month" | "year" | "custom";

interface TimePeriodSelectorProps {
  value: TimePeriod;
  onChange: (period: TimePeriod) => void;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
}

export const TimePeriodSelector = ({
  value,
  onChange,
  dateRange,
  onDateRangeChange,
}: TimePeriodSelectorProps) => {
  const { language, t } = useLanguage();
  const dateLocale = language === 'it' ? it : enUS;
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [tempRange, setTempRange] = useState<{ from?: Date; to?: Date }>({
    from: dateRange?.from,
    to: dateRange?.to,
  });

  const handlePeriodChange = (newPeriod: TimePeriod) => {
    if (newPeriod === "custom") {
      setIsCalendarOpen(true);
    } else {
      onChange(newPeriod);
    }
  };

  const handleDateSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range) {
      setTempRange(range);
    }
  };

  const handleApplyDateRange = () => {
    if (tempRange.from && tempRange.to && onDateRangeChange) {
      onDateRangeChange({ from: tempRange.from, to: tempRange.to });
      onChange("custom");
      setIsCalendarOpen(false);
    }
  };

  const getDisplayValue = () => {
    if (value === "custom" && dateRange) {
      return `${format(dateRange.from, "dd/MM", { locale: dateLocale })} - ${format(dateRange.to, "dd/MM", { locale: dateLocale })}`;
    }
    return t(`time.${value}`);
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={value} onValueChange={handlePeriodChange}>
        <SelectTrigger className="w-[140px] h-9 bg-white/80 backdrop-blur-sm border-gray-200 rounded-full text-sm font-medium shadow-sm text-gray-700">
          <CalendarIcon className="w-4 h-4 mr-2 text-gray-500" />
          <SelectValue>{getDisplayValue()}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">{t('time.today')}</SelectItem>
          <SelectItem value="week">{t('time.week')}</SelectItem>
          <SelectItem value="month">{t('time.month')}</SelectItem>
          <SelectItem value="year">{t('time.year')}</SelectItem>
          <SelectItem value="custom">{t('time.custom_ellipsis')}</SelectItem>
        </SelectContent>
      </Select>

      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-9 px-3 bg-white/80 backdrop-blur-sm border-gray-200 rounded-full text-sm font-medium shadow-sm text-gray-700",
              value === "custom" ? "border-fgb-secondary/50" : ""
            )}
            onClick={() => setIsCalendarOpen(true)}
          >
            <CalendarIcon className="w-4 h-4 mr-2 text-gray-500" />
            {value === "custom" && dateRange ? (
              <span className="text-xs">
                {format(dateRange.from, "dd/MM/yy")} - {format(dateRange.to, "dd/MM/yy")}
              </span>
            ) : (
              <span className="text-xs">{t('time.dates')}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="p-4 space-y-4">
            <h4 className="font-medium text-sm text-gray-700">{t('time.select_date_range')}</h4>
            <Calendar
              mode="range"
              selected={tempRange as { from: Date; to: Date }}
              onSelect={handleDateSelect}
              numberOfMonths={2}
              className="pointer-events-auto"
              locale={dateLocale}
            />
            <div className="flex justify-between items-center pt-2 border-t">
              <div className="text-sm text-gray-500">
                {tempRange.from && tempRange.to && (
                  <span>
                    {format(tempRange.from, "dd MMM yyyy", { locale: dateLocale })} - {format(tempRange.to, "dd MMM yyyy", { locale: dateLocale })}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsCalendarOpen(false);
                    setTempRange({ from: dateRange?.from, to: dateRange?.to });
                  }}
                >
                  {t('time.cancel')}
                </Button>
                <Button
                  size="sm"
                  onClick={handleApplyDateRange}
                  disabled={!tempRange.from || !tempRange.to}
                  className="bg-fgb-secondary hover:bg-fgb-secondary/90"
                >
                  {t('time.apply')}
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
