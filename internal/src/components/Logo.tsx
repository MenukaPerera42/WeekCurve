export function Logomark({ className }: { className?: string }) {
  return (
    <img
      src="/icon.svg"
      alt="WeekCurve"
      width={32}
      height={32}
      className={className ?? "size-8"}
    />
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span role="img" aria-label="WeekCurve" className="inline-flex max-w-full items-center">
      <img
        src="/weekcurve-logo-dark.svg"
        alt=""
        width={160}
        height={40}
        className={`${className ?? "h-8"} w-auto max-w-full dark:hidden`}
      />
      <img
        src="/weekcurve-logo-light.svg"
        alt=""
        width={160}
        height={40}
        className={`${className ?? "h-8"} hidden w-auto max-w-full dark:block`}
      />
    </span>
  );
}
