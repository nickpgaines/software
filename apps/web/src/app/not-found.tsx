import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="text-center max-w-md">
        <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
          404
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-gray-900">
          Page not found
        </h1>
        <p className="mt-3 text-gray-600">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Go back home
          </Link>
        </div>
      </div>
    </main>
  );
}
