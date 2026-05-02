import Link from 'next/link';
import type { CourseHomeBlock, CourseHomePageData, CourseSectionPageData } from '@/lib/course-content';

function ActionLink({ href, label, description, external }: { href: string; label: string; description: string; external?: boolean }) {
  return (
    <Link href={href} className="canvas-action-card" target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>
      <span className="canvas-action-card__label">{label}</span>
      <span className="canvas-action-card__description">{description}</span>
    </Link>
  );
}

function HomeBlockRenderer({ block }: { block: CourseHomeBlock }) {
  switch (block.type) {
    case 'checklist':
      return (
        <section className="canvas-section-card">
          <div className="canvas-section-card__header">
            <h2>{block.title}</h2>
            {block.description ? <p>{block.description}</p> : null}
          </div>
          <ul className="canvas-checklist">
            {block.items.map((item) => (
              <li key={`${item.text}-${item.href ?? 'plain'}`}>
                {item.href ? (
                  <Link href={item.href} target={item.external ? '_blank' : undefined} rel={item.external ? 'noreferrer' : undefined}>
                    {item.text}
                  </Link>
                ) : (
                  <span>{item.text}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      );
    case 'link-grid':
      return (
        <section className="canvas-section-card">
          <div className="canvas-section-card__header">
            <h2>{block.title}</h2>
            {block.description ? <p>{block.description}</p> : null}
          </div>
          <div className="canvas-action-grid">
            {block.items.map((item) => (
              <ActionLink key={`${item.label}-${item.href}`} {...item} />
            ))}
          </div>
        </section>
      );
    case 'table':
      return (
        <section className="canvas-section-card">
          <div className="canvas-section-card__header">
            <h2>{block.title}</h2>
            {block.description ? <p>{block.description}</p> : null}
          </div>
          <div className="canvas-table-card">
            <table className="canvas-data-table">
              {block.caption ? <caption>{block.caption}</caption> : null}
              <thead>
                <tr>
                  {block.columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, index) => (
                  <tr key={`${block.title}-${index}`}>
                    {row.map((cell, cellIndex) => (
                      <td key={`${block.title}-${index}-${cellIndex}`}>{cell || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      );
    case 'notice':
      return (
        <section className={`canvas-section-card canvas-section-card--${block.tone ?? 'neutral'}`}>
          <div className="canvas-section-card__header">
            <h2>{block.title}</h2>
            <p>{block.body}</p>
          </div>
          {block.links?.length ? (
            <div className="canvas-action-grid">
              {block.links.map((item) => (
                <ActionLink key={`${item.label}-${item.href}`} {...item} />
              ))}
            </div>
          ) : null}
        </section>
      );
  }
}

export function CourseHomeView({ data }: { data: CourseHomePageData }) {
  return (
    <div className="user_content canvas-course-page">
      <section className="canvas-hero">
        <div className="canvas-hero__copy">
          <p className="canvas-hero__eyebrow">{data.eyebrow}</p>
          <h1 className="ic-page-h1 canvas-hero__title">{data.title}</h1>
          <p className="canvas-hero__summary">{data.summary}</p>
          <div className="canvas-chip-row">
            {data.badges.map((badge) => (
              <span key={badge} className="canvas-chip">
                {badge}
              </span>
            ))}
          </div>
        </div>
        <div className="canvas-metric-grid">
          {data.metrics.map((metric) => (
            <div key={metric.label} className="canvas-metric-card">
              <span className="canvas-metric-card__value">{metric.value}</span>
              <span className="canvas-metric-card__label">{metric.label}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="canvas-content-stack">
        {data.blocks.map((block, index) => (
          <HomeBlockRenderer key={`${block.type}-${index}`} block={block} />
        ))}
      </div>
    </div>
  );
}

export function CourseSectionView({
  courseCode,
  courseLabel,
  courseHomeHref,
  data,
}: {
  courseCode: string;
  courseLabel: string;
  courseHomeHref: string;
  data: CourseSectionPageData;
}) {
  return (
    <div className="user_content canvas-course-page">
      <p className="ic-course-crumb-label canvas-page-kicker">
        <Link href={courseHomeHref}>{courseCode}</Link> · {courseLabel}
      </p>
      <section className="canvas-section-card canvas-section-card--hero">
        <div className="canvas-section-card__header">
          <h1 className="ic-page-h1">{data.title}</h1>
          <p>{data.intro}</p>
        </div>

        {data.type === 'table' ? (
          <div className="canvas-table-card">
            <table className="canvas-data-table">
              <thead>
                <tr>
                  {data.columns.map((column) => (
                    <th key={column.key}>{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, index) => (
                  <tr key={`${data.title}-${index}`}>
                    {data.columns.map((column) => (
                      <td key={`${data.title}-${index}-${column.key}`}>{row[column.key] || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {data.footer ? <p className="canvas-table-card__footer">{data.footer}</p> : null}
          </div>
        ) : null}

        {data.type === 'feed' ? (
          <ul className="canvas-feed-list">
            {data.items.map((item) => (
              <li key={item.id} className="canvas-feed-list__item">
                <div className="canvas-feed-list__header">
                  <h2>{item.title}</h2>
                  {item.badge ? <span className="canvas-chip canvas-chip--soft">{item.badge}</span> : null}
                </div>
                {item.meta ? <p className="canvas-feed-list__meta">{item.meta}</p> : null}
                {item.body ? <p className="canvas-feed-list__body">{item.body}</p> : null}
              </li>
            ))}
          </ul>
        ) : null}

        {data.type === 'panel' ? (
          <div className="canvas-panel-block">
            <p className="canvas-panel-block__body">{data.body}</p>
            {data.bullets?.length ? (
              <ul className="canvas-checklist">
                {data.bullets.map((bullet) => (
                  <li key={bullet}>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {data.action ? (
              <div className="canvas-panel-block__action">
                <ActionLink {...data.action} />
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
