import { redirect } from "next/navigation";
export default function Demo() {
  redirect("/console/events?add=1");
}
