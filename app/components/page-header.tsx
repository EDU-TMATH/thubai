import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow: ReactNode;
  title: ReactNode;
  description: ReactNode;
  actions?: ReactNode;
  summary?: ReactNode;
  size?: "default" | "wide";
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  summary,
  size = "default",
}: PageHeaderProps) {
  return (
    <section className="glass-panel rounded-4xl px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div
        className={`grid items-center gap-7 ${
          summary ? "lg:grid-cols-[minmax(0,1fr)_360px]" : "lg:grid-cols-[minmax(0,1fr)_auto]"
        }`}
      >
        <div className={size === "wide" ? "max-w-3xl" : "max-w-2xl"}>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-(--accent-deep)">
              {eyebrow}
            </div>
            <h1 className="text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">
              {title}
            </h1>
            <div className="text-base leading-7 text-[rgba(31,26,23,0.74)] lg:leading-8">
              {description}
            </div>
          </div>
        </div>

        {(summary || actions) && (
          <div className="flex min-w-0 flex-col gap-3 lg:max-w-[520px] lg:items-end">
            {summary && <div className="w-full">{summary}</div>}
            {actions && (
              <div className="grid w-full gap-2 sm:grid-cols-2 lg:flex lg:w-auto lg:flex-wrap lg:justify-end">
                {actions}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
