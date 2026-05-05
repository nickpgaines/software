import BoldShell from "../_bold";
import { getIdentity } from "../concept-live/_data";
import { boldConfig } from "./_config";

export const dynamic = "force-dynamic";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const { initials } = await getIdentity();
  return (
    <BoldShell config={boldConfig} initials={initials} homeSlug="concept-bold-9">
      {children}
    </BoldShell>
  );
}
