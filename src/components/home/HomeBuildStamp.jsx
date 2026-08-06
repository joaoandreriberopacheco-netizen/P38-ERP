import { P38_APP_VERSION, P38_BUILD_STAMP_CODE, P38_BUILD_STAMP_AT } from '@/lib/p38BuildInfo.generated';

export default function HomeBuildStamp() {
  if (!P38_BUILD_STAMP_CODE && !P38_APP_VERSION) return null;

  const versionLabel = P38_APP_VERSION ? `v${P38_APP_VERSION}` : null;

  return (
    <p
      className="text-center text-[10px] leading-tight text-muted-foreground/55 tabular-nums pt-4 pb-1 select-none"
      aria-label={`Versão ${versionLabel || ''} ${P38_BUILD_STAMP_CODE}${P38_BUILD_STAMP_AT ? `, publicado em ${P38_BUILD_STAMP_AT}` : ''}`}
    >
      {versionLabel ? <span>{versionLabel}</span> : null}
      {versionLabel && P38_BUILD_STAMP_CODE ? <span className="mx-1.5 text-muted-foreground/40">·</span> : null}
      {P38_BUILD_STAMP_CODE ? <span>{P38_BUILD_STAMP_CODE}</span> : null}
      {P38_BUILD_STAMP_AT ? <span className="mx-1.5 text-muted-foreground/40">·</span> : null}
      {P38_BUILD_STAMP_AT ? <span>{P38_BUILD_STAMP_AT}</span> : null}
    </p>
  );
}
