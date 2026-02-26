import { coreMethods } from "./core";
import { webhookMethods } from "./webhooks";
import { notificationMethods } from "./notifications";
import { paymentLinkMethods } from "./payment-links";
import { rail4Methods } from "./rail4";
import { rail1Methods } from "./rail1";
import { rail2Methods } from "./rail2";
import { ownerMethods } from "./owners";
import { masterGuardrailMethods } from "./master-guardrails";
import { skillMethods } from "./skills";
import { rail5Methods } from "./rail5";
import { approvalMethods } from "./approvals";
import type { IStorage } from "./types";

export type { IStorage };

export const storage: IStorage = {
  ...coreMethods,
  ...webhookMethods,
  ...notificationMethods,
  ...paymentLinkMethods,
  ...rail4Methods,
  ...rail1Methods,
  ...rail2Methods,
  ...ownerMethods,
  ...masterGuardrailMethods,
  ...skillMethods,
  ...rail5Methods,
  ...approvalMethods,
};
