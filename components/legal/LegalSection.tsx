type LegalSectionProps = {
  title: string;
  children: React.ReactNode;
};

export function LegalSection({ title, children }: LegalSectionProps) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-medium text-white">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
