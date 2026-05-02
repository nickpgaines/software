import ResetPasswordForm from "./ResetPasswordForm";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage({
  params,
}: {
  params: { token: string };
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">
            Choose a new password
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Pick something at least 10 characters long.
          </p>
        </div>
        <ResetPasswordForm token={params.token} />
      </div>
    </div>
  );
}
