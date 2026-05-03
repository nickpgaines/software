import Shell from "./_shell";
import { getIdentity } from "./_data";

export const dynamic = "force-dynamic";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const { firstName, initials } = await getIdentity();
  return (
    <Shell greetingName={firstName} initials={initials}>
      {children}
    </Shell>
  );
}
