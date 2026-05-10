import Link from "next/link";

function NumBlock({ num, unit, lbl }: { num: string; unit: string; lbl: string }) {
  return (
    <div className="n">
      <div className="num">
        {num}
        <span className="unit">{unit}</span>
      </div>
      <div className="lbl">{lbl}</div>
    </div>
  );
}

export function CtaFooterSection() {
  const year = new Date().getFullYear();
  return (
    <>
      <section id="cta" className="cta-root ctaA">
        <section className="cta-block">
          <div className="qmark" aria-hidden="true">
            ?
          </div>
          <div className="left">
            <span className="eyebrow">
              <span className="dot" aria-hidden="true" />
              Join us / リーダー募集
            </span>
            <h2>
              あなたが立ち上げる、
              <br />
              最初の一歩は？
            </h2>
            <p className="lead">
              やってみたいことを、ひとりで抱え込まなくていい。
              <br />
              時間とスキルで支え合う仲間が、ここにいます。
            </p>
            <div className="actions">
              <Link href="/apply" className="btn-primary">
                リーダーに応募する <span className="arrow" aria-hidden="true" />
              </Link>
              <a href="#consult" className="btn-secondary">
                <span className="dot" aria-hidden="true" />
                30 分の無料相談から
              </a>
            </div>
            <div className="helper">迷っていても OK / オンライン可</div>
          </div>
          <div className="right">
            <div className="cta-numbers">
              <NumBlock num="2,847" unit="名" lbl="登録メンバー" />
              <NumBlock num="148" unit="件" lbl="累計プロジェクト" />
            </div>
          </div>
        </section>
      </section>
      <footer className="lp-footer">
        <div className="top">
          <div className="brand">
            <div className="logo">
              フィジファン<span className="red-dot">.</span>
            </div>
            <div className="tag">Physifun — Real-world support, real connections</div>
            <p>
              お金じゃない、時間とスキルで支え合う。
              <br />
              リーダーとサポーターをつなぎ、地域のプロジェクトが循環するしくみを運営しています。
            </p>
          </div>
          <div className="links">
            <div className="col">
              <h4>Project</h4>
              <ul>
                <li>
                  <Link href="/projects">プロジェクト一覧</Link>
                </li>
                <li>
                  <a href="#category">カテゴリーで探す</a>
                </li>
                <li>
                  <a href="#voice">リーダーの声</a>
                </li>
                <li>
                  <Link href="/login">サポーター登録</Link>
                </li>
              </ul>
            </div>
            <div className="col">
              <h4>For Leaders</h4>
              <ul>
                <li>
                  <Link href="/apply">リーダー応募</Link>
                </li>
                <li>
                  <a href="#consult">無料相談を予約</a>
                </li>
                <li>
                  <a href="#process">はじめかた</a>
                </li>
                <li>
                  <a href="#faq">よくある質問</a>
                </li>
              </ul>
            </div>
            <div className="col">
              <h4>About</h4>
              <ul>
                <li>
                  <Link href="/about">フィジファンとは</Link>
                </li>
                <li>
                  <Link href="/company">運営会社</Link>
                </li>
                <li>
                  <Link href="/news">お知らせ</Link>
                </li>
                <li>
                  <Link href="/contact">お問い合わせ</Link>
                </li>
              </ul>
            </div>
            <div className="col">
              <h4>Follow</h4>
              <div className="sns-row">
                <a href="https://www.instagram.com/" aria-label="Instagram" target="_blank" rel="noopener noreferrer">
                  <svg viewBox="0 0 24 24">
                    <rect x="3" y="3" width="18" height="18" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
                  </svg>
                </a>
                <a href="https://x.com/" aria-label="X" target="_blank" rel="noopener noreferrer">
                  <svg viewBox="0 0 24 24">
                    <path d="M4 4l16 16M20 4L4 20" />
                  </svg>
                </a>
                <a href="https://note.com/" aria-label="note" target="_blank" rel="noopener noreferrer">
                  <svg viewBox="0 0 24 24">
                    <path d="M5 5h11l3 3v11H5z" />
                    <path d="M9 10h7M9 14h6" />
                  </svg>
                </a>
                <a href="https://www.youtube.com/" aria-label="YouTube" target="_blank" rel="noopener noreferrer">
                  <svg viewBox="0 0 24 24">
                    <rect x="2.5" y="6" width="19" height="12" rx="3" />
                    <path d="M11 10v4l3.5-2z" fill="currentColor" stroke="none" />
                  </svg>
                </a>
              </div>
              <ul style={{ marginTop: 24 }}>
                <li>
                  <Link href="/press">プレスリリース</Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="bottom">
          <div>© {year} Physifun Inc. All rights reserved.</div>
          <div className="legal">
            <Link href="/terms">利用規約</Link>
            <Link href="/privacy">プライバシーポリシー</Link>
            <Link href="/legal">特定商取引法</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
