/* global React */

const Footer = ({ mobile = false }) => (
  <footer className="footer">
    <div className="top">
      <div className="brand">
        <div className="logo">フィジファン<span className="red-dot">.</span></div>
        <div className="tag">Physifun — Real-world support, real connections</div>
        <p>
          お金じゃない、時間とスキルで支え合う。<br />
          リーダーとサポーターをつなぎ、地域のプロジェクトが循環するしくみを運営しています。
        </p>
      </div>
      <div className="links">
        <div className="col">
          <h4>Project</h4>
          <ul>
            <li><a href="#">プロジェクト一覧</a></li>
            <li><a href="#">カテゴリーで探す</a></li>
            <li><a href="#">リーダーの声</a></li>
            <li><a href="#">サポーター登録</a></li>
          </ul>
        </div>
        <div className="col">
          <h4>For Leaders</h4>
          <ul>
            <li><a href="#">リーダー応募</a></li>
            <li><a href="#">無料相談を予約</a></li>
            <li><a href="#">資料ダウンロード</a></li>
            <li><a href="#">よくある質問</a></li>
          </ul>
        </div>
        <div className="col">
          <h4>About</h4>
          <ul>
            <li><a href="#">フィジファンとは</a></li>
            <li><a href="#">運営会社</a></li>
            <li><a href="#">お知らせ</a></li>
            <li><a href="#">お問い合わせ</a></li>
          </ul>
        </div>
        <div className="col">
          <h4>Follow</h4>
          <div className="sns-row">
            <a href="#" aria-label="Instagram">
              <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" /></svg>
            </a>
            <a href="#" aria-label="X">
              <svg viewBox="0 0 24 24"><path d="M4 4l16 16M20 4L4 20" /></svg>
            </a>
            <a href="#" aria-label="note">
              <svg viewBox="0 0 24 24"><path d="M5 5h11l3 3v11H5z" /><path d="M9 10h7M9 14h6" /></svg>
            </a>
            <a href="#" aria-label="YouTube">
              <svg viewBox="0 0 24 24"><rect x="2.5" y="6" width="19" height="12" rx="3" /><path d="M11 10v4l3.5-2z" fill="currentColor" stroke="none" /></svg>
            </a>
          </div>
          <ul style={{marginTop: 24}}>
            <li><a href="#">プレスリリース</a></li>
          </ul>
        </div>
      </div>
    </div>
    <div className="bottom">
      <div>© 2025 Physifun Inc. All rights reserved.</div>
      <div className="legal">
        <a href="#">利用規約</a>
        <a href="#">プライバシーポリシー</a>
        <a href="#">特定商取引法</a>
      </div>
    </div>
  </footer>
);

const NumBlock = ({ num, unit, lbl }) => (
  <div className="n">
    <div className="num">{num}<span className="unit">{unit}</span></div>
    <div className="lbl">{lbl}</div>
  </div>
);

/* ==========================================================
   案 A — 大きな問いかけ + 2 ボタン (左右非対称)
   ========================================================== */
function CtaA({ mobile = false }) {
  return (
    <div className={`cta-root ctaA ${mobile ? "mobile" : ""}`}>
      <section className="cta-block">
        <div className="qmark" aria-hidden>?</div>
        <div className="left">
          <span className="eyebrow"><span className="dot"></span>Join us / リーダー募集</span>
          <h2>
            あなたが立ち上げる、<br />
            最初の一歩は？
          </h2>
          <p className="lead">
            やってみたいことを、ひとりで抱え込まなくていい。<br />
            時間とスキルで支え合う仲間が、ここにいます。
          </p>
          <div className="actions">
            <a href="#apply" className="btn-primary">
              リーダーに応募する <span className="arrow"></span>
            </a>
            <a href="#consult" className="btn-secondary">
              <span className="dot"></span>30 分の無料相談から
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
      <Footer mobile={mobile} />
    </div>
  );
}

/* ==========================================================
   案 B — 問い + 3 ステップカード (応募 / 相談 / FAQ)
   ========================================================== */
function CtaB({ mobile = false }) {
  return (
    <div className={`cta-root ctaB ${mobile ? "mobile" : ""}`}>
      <section className="cta-block">
        <div className="head">
          <span className="eyebrow"><span className="dot"></span>Join us / リーダー募集</span>
          <h2>
            あなたが立ち上げる、<br />
            最初の一歩は？
          </h2>
          <p className="lead">
            完璧な計画はいらない。今いる場所からでいい。<br />
            あなたのペースに合わせて、3 つの入口を用意しました。
          </p>
        </div>
        <div className="steps">
          <div className="step primary">
            <div className="num">STEP / 01 — メイン</div>
            <h3>リーダーに応募する</h3>
            <p>
              やりたいことが固まっている方へ。応募フォームから、専任コーディネーターに繋がります。
            </p>
            <a href="#apply">応募フォームへ <span className="arr"></span></a>
          </div>
          <div className="step">
            <div className="num">STEP / 02 — まずは話す</div>
            <h3>30 分の無料相談</h3>
            <p>
              ぼんやりしたアイデアの段階でOK。オンライン / 対面、どちらも対応しています。
            </p>
            <a href="#consult">日程を選ぶ <span className="arr"></span></a>
          </div>
          <div className="step">
            <div className="num">STEP / 03 — まず知る</div>
            <h3>よくある質問を見る</h3>
            <p>
              費用は？保険は？どんな人が向いてる？— 気になるポイントをまとめています。
            </p>
            <a href="#faq">FAQ を読む <span className="arr"></span></a>
          </div>
        </div>
        <div className="nums-wrap">
          <div className="nums">
            <div>
              <div className="num">2,847<span className="unit">名</span></div>
              <div className="lbl">登録メンバー</div>
            </div>
            <div>
              <div className="num">148<span className="unit">件</span></div>
              <div className="lbl">累計プロジェクト</div>
            </div>
            <div>
              <div className="num">94<span className="unit">%</span></div>
              <div className="lbl">サポーター充足率</div>
            </div>
          </div>
          <div className="small">2025 年 11 月時点 / フィジファン運営調べ</div>
        </div>
      </section>
      <Footer mobile={mobile} />
    </div>
  );
}

/* ==========================================================
   案 C — センター揃え、マニフェスト型
   ========================================================== */
function CtaC({ mobile = false }) {
  return (
    <div className={`cta-root ctaC ${mobile ? "mobile" : ""}`}>
      <section className="cta-block">
        <div className="stamp">For the next leader</div>
        <div className="inner">
          <span className="eyebrow"><span className="dot"></span>Join us / リーダー募集</span>
          <h2>
            あなたが立ち上げる、<br />
            最初の一歩は？
          </h2>
          <div className="sig">完璧じゃなくていい。動きたい気持ちがあれば、それで十分。</div>
          <p className="lead">
            お金で支え合うのではなく、時間とスキルで。<br />
            あなたが現場に立つ、その日まで。私たちが伴走します。
          </p>
          <div className="actions">
            <a href="#apply" className="btn-primary">
              リーダーに応募する <span className="arrow"></span>
            </a>
            <a href="#consult" className="btn-secondary">
              <span className="dot"></span>30 分の無料相談から
            </a>
          </div>
          <div className="nums-row">
            <NumBlock num="2,847" unit="名" lbl="登録メンバー" />
            <NumBlock num="148" unit="件" lbl="累計プロジェクト" />
            <NumBlock num="94" unit="%" lbl="サポーター充足率" />
          </div>
        </div>
      </section>
      <Footer mobile={mobile} />
    </div>
  );
}

Object.assign(window, { CtaA, CtaB, CtaC });
