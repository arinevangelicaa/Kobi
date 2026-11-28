"use client";

import Image from "next/image";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

const menu = [
  { href: "/beranda", label: "Beranda", icon: "4d562", width: 30, height: 30 },
  { href: "/riwayat", label: "Riwayat", icon: "ea0b1", width: 32, height: 30 },
  { href: "/catat", label: "Catat", icon: "d0ad3", width: 27, height: 27 },
  { href: "/split-bill", label: "Split bill", icon: "4df3e", width: 24, height: 24 },
  { href: "/profil", label: "Profil", icon: "e706c", width: 24, height: 24 },
];

export default function BottomNavigation() {
  const segment = useSelectedLayoutSegment();
  const splitBill = segment === "split-bill";
  const homeCream = segment === "catat" || segment === "profil";

  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-app bg-green px-4 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] text-cream"
    >
      <ul className="grid grid-cols-5 gap-1">
        {menu.map(({ href, label, icon, width, height }) => {
          const aktif = segment === href.slice(1);
          let src = `/assets/beranda/${icon}.svg`;
          if (splitBill) src = `/assets/split-bill${href}.svg`;
          if (homeCream && href === "/beranda") src = "/assets/catat/home.svg";
          if (aktif && href === "/catat") src = "/assets/catat/active-catat.svg";
          if (aktif && href === "/profil") src = "/assets/profil/active-profile.svg";

          return (
            <li key={href}>
              <Link
                href={href}
                prefetch={false}
                aria-current={aktif ? "page" : undefined}
                className="flex min-h-[52px] flex-col items-center justify-center rounded-lg text-xxs lowercase focus-visible:outline-2 focus-visible:outline-yellow"
              >
                <span className="relative grid size-9 place-items-center">
                  {aktif && (
                    <Image
                      src={splitBill ? "/assets/split-bill/active.svg" : "/assets/beranda/2a11f.svg"}
                      alt=""
                      width={36}
                      height={36}
                      className="absolute inset-0"
                    />
                  )}
                  <Image
                    src={src}
                    alt=""
                    width={width}
                    height={height}
                    className={!splitBill && !homeCream && href === "/beranda" && !aktif ? "relative brightness-0 invert" : "relative"}
                    style={
                      splitBill && href === "/catat"
                        ? { width: 27.6213, height: 27.6213 }
                        : icon === "ea0b1"
                          ? { width: 31.5003 }
                          : undefined
                    }
                  />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
