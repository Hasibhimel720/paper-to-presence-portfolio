type ExperienceDateRange = {
  dates: string;
  startDate?: string | undefined;
  endDate?: string | undefined;
  isCurrent?: boolean | undefined;
};

function formatMonthYear(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatExperienceDateRange(experience: ExperienceDateRange) {
  if (!experience.startDate) return experience.dates;
  const start = formatMonthYear(experience.startDate);
  if (experience.isCurrent) return `${start} – Present`;
  if (experience.endDate) return `${start} – ${formatMonthYear(experience.endDate)}`;
  return experience.dates || start;
}

export function experienceDateRangeLabel(startDate: string, endDate: string, isCurrent: boolean) {
  if (!startDate) return "";
  const start = formatMonthYear(startDate);
  if (isCurrent) return `${start} – Present`;
  return endDate ? `${start} – ${formatMonthYear(endDate)}` : start;
}
