import Link from "next/link";
import styles from "./SimpleCheckout.module.css";

export default function CustomerHeader({ checkout = false }: { checkout?: boolean }) {
  return (
    <header className={styles.header}>
      <Link href="/tickets" className={styles.brand} aria-label="Bluff Tickets home">
        bluff<span>tickets</span>
      </Link>
      <nav aria-label="Customer navigation" className={styles.customerNav}>
        <Link href="/tickets" aria-current={checkout ? undefined : "page"}>Browse events</Link>
        {checkout && <span aria-current="step">Checkout</span>}
      </nav>
    </header>
  );
}
