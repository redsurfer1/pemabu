import MarketingNav from "@/components/home/MarketingNav";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MarketingNav />
      <div className="pt-[60px]">{children}</div>
    </>
  );
}
