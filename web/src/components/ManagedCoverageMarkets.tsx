import { getCatalog } from "@/lib/service";
import { buildCoverages } from "@/lib/coverage";
import { db } from "@/lib/store";
import BusinessCoverageMarkets from "./BusinessCoverageMarkets";
export default async function ManagedCoverageMarkets() {
  const { catalog, universe } = await getCatalog();
  const offers = db.offers();
  const events = catalog.filter((event) => offers[event.id]).map((event) => ({ event, offer: offers[event.id], coverages: buildCoverages(universe, event) }));
  return <BusinessCoverageMarkets events={events} />;
}
