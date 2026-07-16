import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Admin Dashboard Redirect",
  robots: { follow: false, index: false },
};

export default function AdminAliasPage() {
  redirect("/dashboard/admin");
}
