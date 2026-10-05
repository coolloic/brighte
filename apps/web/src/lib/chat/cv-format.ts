// How CV dates read, the same in the chat preview and the PDF.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2019" stays "2019", "2019-03" is "Mar 2019", "present" is "Present". */
export function formatDate(date: string): string {
  if (date === "present") return "Present";
  const [year, month] = date.split("-");
  return month ? `${MONTHS[Number(month) - 1]} ${year}` : year;
}

/** A role's dates: "Mar 2021 – Present", "From 2019", "Until 2020". */
export function dateRange(start?: string, end?: string): string | undefined {
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  if (start) return `From ${formatDate(start)}`;
  if (end) return end === "present" ? "Present" : `Until ${formatDate(end)}`;
  return undefined;
}

/** A qualification's dates: an end year alone is when it was completed ("2016", not "Until 2016"). */
export function educationDates(start?: string, end?: string): string | undefined {
  return start ? dateRange(start, end) : end && formatDate(end);
}
