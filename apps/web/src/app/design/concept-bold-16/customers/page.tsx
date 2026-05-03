import { getCustomers } from "../../concept-live/_data";
import CustomersView from "../../concept-live/customers/CustomersView";

export const dynamic = "force-dynamic";

export default async function Page() {
  const customers = await getCustomers(50);
  return <CustomersView customers={customers} />;
}
