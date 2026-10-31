import { handleRegistrationWebhook } from "@/lib/sms-registration-webhook";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handleRegistrationWebhook(req, "customer-profile");
}
export async function POST(req: Request) {
  return handleRegistrationWebhook(req, "customer-profile");
}
