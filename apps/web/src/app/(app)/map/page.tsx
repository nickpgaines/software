import nextDynamic from "next/dynamic";

const MapClient = nextDynamic(() => import("@/components/MapClient"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-x-0 top-14 bottom-0 flex items-center justify-center text-sm text-slate-500">
      Loading map…
    </div>
  ),
});

export default function MapPage() {
  return <MapClient />;
}
