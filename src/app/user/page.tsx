import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "User Dashboard Redirect",
  robots: { follow: false, index: false },
};

export default function UserAliasPage() {
  redirect("/dashboard/user");
}
