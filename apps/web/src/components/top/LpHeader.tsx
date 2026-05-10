"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

type NavItem = { label: string; href: string };

const LP_NAV: NavItem[] = [
  { label: "サービス", href: "/#cycle" },
  { label: "事例", href: "/#category" },
  { label: "はじめかた", href: "/#process" },
  { label: "FAQ", href: "/#faq" },
];

const MY_NAV: NavItem[] = [{ label: "マイプロジェクト", href: "/my/projects" }];

function resolveNav(pathname: string | null): NavItem[] {
  if (!pathname || pathname === "/") return LP_NAV;
  if (pathname.startsWith("/my")) return MY_NAV;
  return [];
}

export function LpHeader() {
  const pathname = usePathname();
  const nav = resolveNav(pathname);
  const { data: session, status } = useSession();
  const [userOpen, setUserOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" });
  };

  return (
    <>
      <header className="lp-header">
        <Link href="/" className="logo" aria-label="フィジファン トップへ">
          <Image src="/images/logo-black.png" alt="フィジファン" width={140} height={34} priority />
        </Link>

        {nav.length > 0 ? (
          <nav className="nav" aria-label="メインナビゲーション">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="nav-item">
                {n.label}
              </Link>
            ))}
          </nav>
        ) : (
          <span aria-hidden="true" />
        )}

        <div className="right">
          {status === "loading" ? null : session ? (
            <div className="user-menu" ref={userMenuRef}>
              <button
                type="button"
                className="user-btn"
                onClick={() => setUserOpen((v) => !v)}
                aria-expanded={userOpen}
                aria-haspopup="true"
              >
                <span>{session.user?.name ?? "アカウント"}</span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {userOpen && (
                <div className="user-dropdown" role="menu">
                  <Link href="/my/profile" onClick={() => setUserOpen(false)}>
                    プロフィール
                  </Link>
                  <Link href="/my/projects" onClick={() => setUserOpen(false)}>
                    マイプロジェクト
                  </Link>
                  <hr />
                  <button type="button" onClick={handleSignOut}>
                    ログアウト
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/login" className="login-link">
                ログイン
              </Link>
              <Link href="/apply" className="apply">
                プロジェクトをつくる
              </Link>
            </>
          )}

          <button
            type="button"
            className="menu-btn"
            aria-label="メニュー"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {mobileOpen && (
        <div className="lp-mobile-panel">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setMobileOpen(false)}>
              {n.label}
            </Link>
          ))}
          {session ? (
            <>
              <Link href="/my/profile" onClick={() => setMobileOpen(false)}>
                プロフィール
              </Link>
              <Link href="/my/projects" onClick={() => setMobileOpen(false)}>
                マイプロジェクト
              </Link>
              <button type="button" onClick={handleSignOut}>
                ログアウト
              </button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={() => setMobileOpen(false)}>
                ログイン
              </Link>
              <Link href="/apply" className="apply" onClick={() => setMobileOpen(false)}>
                プロジェクトをつくる
              </Link>
            </>
          )}
        </div>
      )}
    </>
  );
}
