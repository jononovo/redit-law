import { registerRailCallbacks } from "@/lib/approvals/service";
import { fulfillRail2Approval, fulfillRail2Denial } from "@/lib/rail2/fulfillment";

registerRailCallbacks("rail2", {
  onApprove: fulfillRail2Approval,
  onDeny: fulfillRail2Denial,
});
