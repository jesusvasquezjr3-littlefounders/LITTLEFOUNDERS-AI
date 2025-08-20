import * as React from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

type DatePickerView = 'years' | 'months' | 'days';

interface DatePickerProps {
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  disabled?: (date: Date) => boolean;
  placeholder?: string;
  className?: string;
}

export function DatePicker({
  selected,
  onSelect,
  disabled,
  placeholder = "Selecciona una fecha",
  className
}: DatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [currentView, setCurrentView] = React.useState<DatePickerView>('years');
  const [tempDate, setTempDate] = React.useState<Date>(selected || new Date());
  const [currentPage, setCurrentPage] = React.useState(0);

  React.useEffect(() => {
    if (selected) {
      setTempDate(selected);
    }
  }, [selected]);

  const handleYearSelect = (year: number) => {
    const newDate = new Date(tempDate);
    newDate.setFullYear(year);
    setTempDate(newDate);
    setCurrentView('months');
  };

  const handleMonthSelect = (month: number) => {
    const newDate = new Date(tempDate);
    newDate.setMonth(month);
    setTempDate(newDate);
    setCurrentView('days');
  };

  const handleDaySelect = (date: Date | undefined) => {
    if (date) {
      onSelect?.(date);
      setIsOpen(false);
      setCurrentView('years');
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setCurrentView('years');
      setCurrentPage(0);
    }
  };

  const renderYearsView = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    
    // Generar años desde 1900 hasta el año actual
    for (let year = currentYear; year >= 1900; year--) {
      years.push(year);
    }

    // Mostrar solo 20 años a la vez (2 décadas)
    const yearsPerPage = 20;
    
    const totalPages = Math.ceil(years.length / yearsPerPage);
    const startIndex = currentPage * yearsPerPage;
    const endIndex = startIndex + yearsPerPage;
    const visibleYears = years.slice(startIndex, endIndex);

    const handleNextPage = () => {
      if (currentPage < totalPages - 1) {
        setCurrentPage(currentPage + 1);
      }
    };

    const handlePrevPage = () => {
      if (currentPage > 0) {
        setCurrentPage(currentPage - 1);
      }
    };

         return (
       <div className="p-3 space-y-4">
         <div className="flex items-center justify-between">
           <Button
             variant="ghost"
             size="sm"
             onClick={handlePrevPage}
             disabled={currentPage === 0}
             className="h-8 w-8 p-0"
           >
             <ChevronLeft className="h-4 w-4" />
           </Button>
           <div className="text-center font-medium">
             Selecciona el año
           </div>
           <Button
             variant="ghost"
             size="sm"
             onClick={handleNextPage}
             disabled={currentPage === totalPages - 1}
             className="h-8 w-8 p-0"
           >
             <ChevronRight className="h-4 w-4" />
           </Button>
         </div>

        {/* Grid de años */}
        <div className="grid grid-cols-5 gap-1">
          {visibleYears.map((year) => (
            <Button
              key={year}
              variant={tempDate.getFullYear() === year ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => handleYearSelect(year)}
            >
              {year}
            </Button>
          ))}
        </div>

        {/* Indicadores de página */}
        <div className="flex justify-center space-x-1">
          {Array.from({ length: totalPages }, (_, i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full ${
                i === currentPage ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>
    );
  };

  const renderMonthsView = () => {
    const months = [
      { value: 0, label: "Enero" },
      { value: 1, label: "Febrero" },
      { value: 2, label: "Marzo" },
      { value: 3, label: "Abril" },
      { value: 4, label: "Mayo" },
      { value: 5, label: "Junio" },
      { value: 6, label: "Julio" },
      { value: 7, label: "Agosto" },
      { value: 8, label: "Septiembre" },
      { value: 9, label: "Octubre" },
      { value: 10, label: "Noviembre" },
      { value: 11, label: "Diciembre" }
    ];

    return (
      <div className="p-3 space-y-4">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView('years')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center font-medium">
            {tempDate.getFullYear()}
          </div>
          <div className="w-8" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {months.map((month) => (
            <Button
              key={month.value}
              variant={tempDate.getMonth() === month.value ? "default" : "outline"}
              size="sm"
              className="h-10"
              onClick={() => handleMonthSelect(month.value)}
            >
              {month.label}
            </Button>
          ))}
        </div>
      </div>
    );
  };

  const renderDaysView = () => {
    return (
      <div className="p-3">
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView('months')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center font-medium">
            {format(tempDate, "MMMM yyyy", { locale: es })}
          </div>
          <div className="w-8" />
        </div>
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleDaySelect}
          disabled={disabled}
          initialFocus
          defaultMonth={tempDate}
        />
      </div>
    );
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'years':
        return renderYearsView();
      case 'months':
        return renderMonthsView();
      case 'days':
        return renderDaysView();
      default:
        return renderYearsView();
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selected ? format(selected, "PPP", { locale: es }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {renderCurrentView()}
      </PopoverContent>
    </Popover>
  );
}
