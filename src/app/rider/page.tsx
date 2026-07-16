import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Rider Dashboard Redirect",
  robots: { follow: false, index: false },
};

export default function RiderAliasPage() {
  redirect("/dashboard/rider");
}
