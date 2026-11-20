import Link from "next/link";
import CustomerHeader from "@/components/CustomerHeader";
import styles from "@/components/SimpleCheckout.module.css";

export default function EventNotFound() {
  return <div className={styles.page}><CustomerHeader /><main className={styles.main}><section className={styles.emptyState}><h1>This event isn’t available.</h1><Link href="/tickets" className={styles.secondary}>Browse upcoming events</Link></section></main></div>;
}
