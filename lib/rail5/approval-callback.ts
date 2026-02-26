import { registerRailCallbacks } from "@/lib/approvals/service";
import { fulfillRail5Approval, fulfillRail5Denial } from "./fulfillment";

registerRailCallbacks("rail5", {
  onApprove: fulfillRail5Approval,
  onDeny: fulfillRail5Denial,
});
