import { registerRailCallbacks } from "@/lib/approvals/service";
import { fulfillRail1Approval, fulfillRail1Denial } from "./fulfillment";

registerRailCallbacks("rail1", {
  onApprove: fulfillRail1Approval,
  onDeny: fulfillRail1Denial,
});
