export type OrderStep = "route" | "package" | "confirm";

export function activeNavHref(pathname: string, hrefs: string[]): string | undefined {
  return hrefs
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}

export function orderStepForScroll(position: {
  packageTop: number;
  confirmTop: number | null;
}): OrderStep {
  if (position.confirmTop !== null && position.confirmTop <= 160) return "confirm";
  if (position.packageTop <= 160) return "package";
  return "route";
}
