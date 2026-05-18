import MarketingNav from "@/components/home/MarketingNav";
import { SiteLegalFooter } from "@/components/legal/SiteLegalFooter";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MarketingNav />
      <div className="flex min-h-screen flex-col bg-[#0A1628] pt-[60px]">
        <div className="flex-1">{children}</div>
        <SiteLegalFooter className="border-t border-white/10 px-6 py-8" />
      </div>
    </>
  );
}
