import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { PolicyDialog } from "@/components/leads/policy-dialog";
import { getToday } from "@/lib/dates";
import { getCurrentLegalDocument, type PublicLegalDocument } from "@/lib/queries/legal";
import { getSettings } from "@/lib/queries/settings";
import { SETTINGS_DEFAULTS, type SiteSettings } from "@/lib/settings-defaults";
import { Container } from "./container";

/** Год основания клуба — начало диапазона в копирайте */
const COPYRIGHT_SINCE = "2019";
const POLICY_FALLBACK_TITLE = "Политика конфиденциальности";

const LINK_CLASS =
  "text-success hover:text-white underline-offset-4 transition-colors hover:underline";

/**
 * Футер сайта (`.footer.md-bottom-only` старого сайта). Год и данные из БД — только в
 * динамической части: `new Date()` вне `connection()` ломает пререндер Cache Components.
 */
export function SiteFooter() {
  return (
    <footer className="bg-footer text-[13px] text-white">
      <Container>
        <Suspense
          fallback={<FooterContent year={null} policy={null} settings={SETTINGS_DEFAULTS} />}
        >
          <FooterWithData />
        </Suspense>
      </Container>
    </footer>
  );
}

async function FooterWithData() {
  await connection();
  const [settings, policy] = await Promise.all([getSettings(), getCurrentLegalDocument("policy")]);
  return <FooterContent year={getToday().slice(0, 4)} policy={policy} settings={settings} />;
}

type FooterContentProps = {
  /** `null` в статической оболочке — выводится только год основания */
  year: string | null;
  /** `null` — документа нет или он ещё грузится: обычная ссылка на /politika */
  policy: PublicLegalDocument | null;
  settings: SiteSettings;
};

function FooterContent({ year, policy, settings }: FooterContentProps) {
  const { name, inn } = settings.operator;
  const operatorLine = [name.trim(), inn.trim() ? `ИНН ${inn.trim()}` : ""]
    .filter(Boolean)
    .join(", ");
  const copyrightYears =
    year && year !== COPYRIGHT_SINCE ? `${COPYRIGHT_SINCE} – ${year}` : COPYRIGHT_SINCE;

  return (
    <div className="flex flex-col gap-4 py-[clamp(20px,2vw,32px)] leading-relaxed font-medium sm:flex-row sm:items-center sm:justify-between">
      <p>
        <strong className="font-bold">Copyright © {copyrightYears}</strong>
        <br />
        Все права защищены.
      </p>
      <div className="flex flex-col gap-1 sm:items-end sm:text-right">
        <p className="flex flex-wrap gap-x-5 gap-y-1 sm:justify-end">
          {policy ? (
            <PolicyDialog title={policy.title || POLICY_FALLBACK_TITLE} markdown={policy.text}>
              <button type="button" className={LINK_CLASS}>
                {POLICY_FALLBACK_TITLE}
              </button>
            </PolicyDialog>
          ) : (
            <Link href="/politika" className={LINK_CLASS}>
              {POLICY_FALLBACK_TITLE}
            </Link>
          )}
          <Link href="/soglasie" className={LINK_CLASS}>
            Согласие на обработку ПДн
          </Link>
        </p>
        {operatorLine ? <p className="text-white/60">{operatorLine}</p> : null}
      </div>
    </div>
  );
}
