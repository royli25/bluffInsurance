import Image from "next/image";
import styles from "./ProviderLogo.module.css";

export default function ProviderLogo({ provider, dark = false }: {
  provider: "gemini" | "arc" | "quicknode";
  dark?: boolean;
}) {
  const logo = {
    gemini: { name: "Gemini", src: "/brands/gemini.svg", width: 85, height: 18 },
    arc: { name: "Arc", src: "/brands/arc.svg", width: 58, height: 20 },
    quicknode: { name: "Quicknode", src: `/brands/quicknode-${dark ? "white" : "black"}.svg`, width: 98, height: 17 },
  }[provider];
  return <Image unoptimized alt={logo.name} src={logo.src} width={logo.width} height={logo.height}
    className={`${styles.logo} ${(provider === "gemini" && dark) || (provider === "arc" && !dark) ? styles.inverted : ""}`} />;
}
