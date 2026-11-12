export function SectionHead({ eyebrow, title, children, center }) {
  return (
    <div className={`sec-head ${center ? 'center' : ''}`}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2>{title}</h2>
      {children && <p className="sec-sub">{children}</p>}
    </div>
  );
}

export function PageHead({ eyebrow, title, children }) {
  return (
    <section className="page-head">
      <div className="page-glow" aria-hidden="true" />
      <div className="wrap">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {children && <p className="page-sub">{children}</p>}
      </div>
    </section>
  );
}
