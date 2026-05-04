import nextDynamic from "next/dynamic";

const MapClient = nextDynamic(() => import("@/components/MapClient"), {
  ssr: false,
  loading: () => (
    <div
      className="fixed inset-0 flex items-center justify-center text-sm text-zinc-400"
      style={{ top: "56px" }}
    >
      Loading map…
    </div>
  ),
});

export default function MapPage() {
  return <MapClient />;
}
