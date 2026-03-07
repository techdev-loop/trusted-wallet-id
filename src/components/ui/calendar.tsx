import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "p-4 rounded-3xl bg-card shadow-[0_18px_60px_rgba(15,23,42,0.35)] border border-border/60",
        className,
      )}
      classNames={{
        months: "flex flex-col space-y-4",
        month: "space-y-4",
        caption: "flex flex-col items-center gap-2 pt-1 relative",
        // Hide the default Month Year text so we only show the dropdowns and avoid duplication.
        caption_label: "sr-only",
        nav: "absolute inset-y-0 flex items-center justify-between w-full px-4",
        nav_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 rounded-full bg-muted/60 hover:bg-muted text-foreground/70 p-0",
        ),
        nav_button_previous: "",
        nav_button_next: "",
        caption_dropdowns: "flex items-center gap-2 text-sm font-medium text-foreground",
        dropdown:
          "inline-flex items-center rounded-xl border border-border/70 bg-muted/70 px-2 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
        dropdown_month: "capitalize",
        dropdown_year: "",
        table: "w-full border-collapse space-y-1",
        head_row: "flex justify-between px-1",
        head_cell: "text-[0.7rem] font-medium text-muted-foreground w-9 text-center",
        row: "flex w-full mt-1 justify-between",
        cell:
          "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20 flex items-center justify-center",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 rounded-full p-0 text-sm font-medium text-foreground data-[outside=true]:text-muted-foreground/60 aria-selected:opacity-100",
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-foreground text-background hover:bg-foreground hover:text-background focus:bg-foreground focus:text-background rounded-full shadow-[0_8px_24px_rgba(15,23,42,0.65)]",
        day_today: "border border-accent bg-accent/10 text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground opacity-40 aria-selected:bg-foreground/20 aria-selected:text-background",
        day_disabled: "text-muted-foreground/60 opacity-50",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
