export function Logomark({ className }: { className?: string }) {
  return (
    <img src="/icon.svg" alt="WeekCurve" className={className ?? "size-8"} />
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span role="img" aria-label="WeekCurve" className="inline-flex max-w-full items-center">
      <img
        src="/weekcurve-logo-dark.svg"
        alt=""
        className={`${className ?? "h-8"} w-auto max-w-full dark:hidden`}
      />
      <img
        src="/weekcurve-logo-light.svg"
        alt=""
        className={`${className ?? "h-8"} hidden w-auto max-w-full dark:block`}
      />
    </span>
  );
}
