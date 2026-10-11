export function Logomark({ className }: { className?: string }) {
  return (
    <img src="/icon.svg" alt="WeekCurve" className={className ?? "size-8"} />
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <picture>
      <source
        media="(prefers-color-scheme: dark)"
        srcSet="/weekcurve-logo-dark.svg"
      />
      <img
        src="/weekcurve-logo-light.svg"
        alt="WeekCurve"
        className={className ?? "h-8 w-auto"}
      />
    </picture>
  );
}
