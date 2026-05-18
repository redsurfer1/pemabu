type DisclaimerCalloutProps = {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
};

/** High-visibility callout for the Investment Disclaimer page. */
export function DisclaimerCallout({ children, variant = "primary" }: DisclaimerCalloutProps) {
  const styles =
    variant === "primary"
      ? "border-2 border-amber-500/60 bg-amber-950/40 text-amber-50"
      : "border border-amber-500/30 bg-amber-950/20 text-amber-100/90";

  return (
    <div role="note" className={`rounded-lg px-5 py-4 text-sm leading-relaxed ${styles}`}>
      {children}
    </div>
  );
}
