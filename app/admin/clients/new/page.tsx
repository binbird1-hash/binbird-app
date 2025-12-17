import { redirect } from "next/navigation";

export const metadata = {
  title: "Client list • Admin",
};

export default function AdminAddClientPage() {
  redirect("/admin/clients");
}
