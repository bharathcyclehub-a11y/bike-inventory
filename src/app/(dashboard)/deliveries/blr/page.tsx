"use client";

import { DeliveryListView } from "../_components/delivery-list-view";

export default function BLRDeliveriesPage() {
  return (
    <DeliveryListView
      title="Bangalore Deliveries"
      backHref="/deliveries"
      fetchUrl="/api/deliveries"
      fetchParams={{ outstation: "false" }}
      statusFilters={["ALL", "PENDING", "SCHEDULED", "OUT_FOR_DELIVERY", "DELIVERED"]}
      clientFilter={(d) => d.status !== "WALK_OUT" && d.status !== "PREBOOKED"}
      emptyMessage="No Bangalore deliveries"
    />
  );
}
