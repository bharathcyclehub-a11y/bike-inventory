"use client";

import { DeliveryListView } from "../_components/delivery-list-view";

export default function WalkoutDeliveriesPage() {
  return (
    <DeliveryListView
      title="Walk-out Deliveries"
      backHref="/deliveries"
      fetchUrl="/api/deliveries"
      fetchParams={{ status: "WALK_OUT" }}
      statusFilters={[]}
      showAging={false}
      emptyMessage="No walk-out deliveries"
    />
  );
}
