import { registerRailCallbacks } from "@/lib/approvals/service";
import { fulfillRail4Approval, fulfillRail4Denial } from "@/lib/rail4/fulfillment";

registerRailCallbacks("rail4", {
  onApprove: fulfillRail4Approval,
  onDeny: fulfillRail4Denial,
});
