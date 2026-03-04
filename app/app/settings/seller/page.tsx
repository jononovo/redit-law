"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SellerSettingsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/app/shop");
  }, [router]);
  return null;
}
