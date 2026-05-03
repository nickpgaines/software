import { getCustomers } from "../_data";
import CustomersView from "./CustomersView";

export const dynamic = "force-dynamic";

export default async function Page() {
  const customers = await getCustomers(50);
  return <CustomersView customers={customers} />;
}
