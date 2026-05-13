"use client";

import { DeliveryListView } from "../_components/delivery-list-view";

export default function OutstationDeliveriesPage() {
  return (
    <DeliveryListView
      title="Outstation Deliveries"
      backHref="/deliveries"
      fetchUrl="/api/deliveries"
      fetchParams={{ outstation: "true" }}
      statusFilters={["ALL", "PENDING", "SCHEDULED", "PACKED", "OUT_FOR_DELIVERY", "SHIPPED", "IN_TRANSIT", "DELIVERED"]}
      showCourier
      emptyMessage="No outstation deliveries"
    />
  );
}
