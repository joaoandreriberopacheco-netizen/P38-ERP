import { P38_BUILD_STAMP_CODE, P38_BUILD_STAMP_AT } from '@/lib/p38BuildInfo.generated';

export default function HomeBuildStamp() {
  if (!P38_BUILD_STAMP_CODE) return null;

  return (
    <p
      className="text-center text-[10px] leading-tight text-muted-foreground/55 tabular-nums pt-4 pb-1 select-none"
      aria-label={`Versão do sistema ${P38_BUILD_STAMP_CODE}${P38_BUILD_STAMP_AT ? `, publicado em ${P38_BUILD_STAMP_AT}` : ''}`}
    >
      <span>{P38_BUILD_STAMP_CODE}</span>
      {P38_BUILD_STAMP_AT ? <span className="mx-1.5 text-muted-foreground/40">·</span> : null}
      {P38_BUILD_STAMP_AT ? <span>{P38_BUILD_STAMP_AT}</span> : null}
    </p>
  );
}
