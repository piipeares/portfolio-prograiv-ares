import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useStore } from '@nanostores/react';
import {
  PROJECTS,
  getChannel,
  projectsForChannel,
  type Project,
} from '../../data/profile';
import { $channel, setChannel } from '../../stores/signal';

const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const categoryChannel: Record<Project['category'], number> = {
  imagen: 1,
  interfaz: 2,
  sistema: 3,
};

export default function ProjectExplorer() {
  const storedChannel = useStore($channel);
  const [hydrated, setHydrated] = useState(false);

  // El HTML se genera con el canal 0. Recién después de hidratar se lee el
  // store compartido: evita un mismatch de hidratación si el usuario sintonizó
  // antes de que esta isla entrara en pantalla.
  useEffect(() => {
    setHydrated(true);
  }, []);

  const channel = hydrated ? storedChannel : 0;
  const activeChannel = getChannel(channel);

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Project | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const filtered = useMemo(() => {
    const base = projectsForChannel(channel);
    const needle = normalize(query.trim());
    if (!needle) return base;
    return base.filter((project) => {
      const haystack = normalize(
        [project.title, project.subtitle, project.categoryLabel, project.year, project.description, ...project.tools].join(' '),
      );
      return haystack.includes(needle);
    });
  }, [channel, query]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (selected && !dialog.open) dialog.showModal();
    if (!selected && dialog.open) dialog.close();
    if (selected) dialog.scrollTop = 0;
  }, [selected]);

  const reset = () => {
    setQuery('');
    setChannel(0);
  };

  const clearSearch = () => setQuery('');

  const selectedIndex = selected ? PROJECTS.findIndex((project) => project.id === selected.id) : -1;

  const move = (direction: 1 | -1) => {
    if (selectedIndex < 0) return;
    const next = PROJECTS[(selectedIndex + direction + PROJECTS.length) % PROJECTS.length];
    setSelected(next);
  };

  const closeDialog = () => dialogRef.current?.close();

  return (
    <div className="work">
      <div className="work__toolbar">
        <div className="work__active">
          <p className="work__active-code">
            <span className="work__active-dot" aria-hidden="true" />
            {activeChannel.code}
          </p>
          <p className="work__active-name">{activeChannel.label}</p>
          <p className="work__active-desc">{activeChannel.description}</p>
          {channel !== 0 && (
            <button type="button" className="work__reset" onClick={reset}>
              Ver todo el espectro
            </button>
          )}
        </div>

        <div className="work__search">
          <label htmlFor="work-search">Buscar en la obra</label>
          <div className="work__input-wrap">
            <input
              id="work-search"
              type="search"
              value={query}
              placeholder="Título, herramienta, año…"
              autoComplete="off"
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button type="button" className="work__clear" onClick={clearSearch} aria-label="Limpiar búsqueda">
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="work__count" aria-live="polite">
        {filtered.length} de {PROJECTS.length} piezas
        {query ? ` · búsqueda “${query}”` : ` · ${activeChannel.label}`}
      </p>

      {filtered.length > 0 ? (
        <ul className="work__grid">
          {filtered.map((project) => (
            <li
              key={project.id}
              className="work-card"
              style={{ '--accent': project.accent } as CSSProperties}
            >
              <article>
                <div className="work-card__cover" data-cover={project.cover} aria-hidden="true">
                  <span className="work-card__code">{project.code}</span>
                  <span className="work-card__cover-label">{project.categoryLabel}</span>
                  <span className="work-card__glyph" />
                </div>
                <div className="work-card__body">
                  <p className="work-card__meta">
                    <span>{project.year}</span>
                    <span>{project.categoryLabel}</span>
                  </p>
                  <h3 className="work-card__title">{project.title}</h3>
                  <p className="work-card__subtitle">{project.subtitle}</p>
                  <p className="work-card__tools">{project.tools.slice(0, 3).join(' · ')}</p>
                  <span className="work-card__cta" aria-hidden="true">
                    Abrir ficha <span>→</span>
                  </span>
                </div>
                <button
                  type="button"
                  className="work-card__hit"
                  onClick={() => setSelected(project)}
                  aria-label={`Abrir ficha de ${project.title}. ${project.categoryLabel}, ${project.year}.`}
                >
                  <span className="sr-only">Abrir ficha</span>
                </button>
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <div className="work-empty panel" role="status">
          <div className="work-empty__signal" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <p className="work-empty__kicker">0 RESULTADOS</p>
            <h3 className="work-empty__title">Sin resultados</h3>
            <p className="work-empty__text">
              No hay piezas que coincidan con “{query}” en {activeChannel.label.toLowerCase()}. Probá con otra
              palabra o abrí todo el espectro.
            </p>
            <div className="work-empty__actions">
              <button type="button" className="btn" onClick={clearSearch}>
                Limpiar búsqueda
              </button>
              <button type="button" className="btn btn--primary" onClick={reset}>
                Abrir todo
              </button>
            </div>
          </div>
        </div>
      )}

      <dialog
        ref={dialogRef}
        className="project-dialog"
        aria-labelledby="project-dialog-title"
        onClose={() => setSelected(null)}
        onClick={(event) => {
          const dialog = dialogRef.current;
          if (!dialog) return;
          const rect = dialog.getBoundingClientRect();
          const isBackdrop =
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom;
          if (isBackdrop) closeDialog();
        }}
      >
        {selected && (
          <div className="project-dialog__inner" style={{ '--accent': selected.accent } as CSSProperties}>
            <header className="project-dialog__bar">
              <span className="project-dialog__bar-code">
                {selected.code} · {selected.categoryLabel} · {selected.year}
              </span>
              <button type="button" className="project-dialog__close" onClick={closeDialog} aria-label="Cerrar ficha">
                <span aria-hidden="true">×</span>
              </button>
            </header>

            <div className="project-dialog__hero" data-cover={selected.cover} aria-hidden="true">
              <span className="project-dialog__hero-code">{selected.code}</span>
              <span className="project-dialog__hero-year">{selected.year}</span>
            </div>

            <div className="project-dialog__body">
              <p className="project-dialog__channel">
                {getChannel(categoryChannel[selected.category]).code} /{' '}
                {getChannel(categoryChannel[selected.category]).short}
              </p>
              <h2 id="project-dialog-title" className="project-dialog__title">
                {selected.title}
              </h2>
              <p className="project-dialog__subtitle">{selected.subtitle}</p>

              <div className="project-dialog__columns">
                <div className="project-dialog__main">
                  <p className="project-dialog__description">{selected.description}</p>

                  <div className="project-dialog__block">
                    <h3>El desafío</h3>
                    <p>{selected.challenge}</p>
                  </div>

                  <div className="project-dialog__block">
                    <h3>Lo que quedó</h3>
                    <p>{selected.learning}</p>
                  </div>
                </div>

                <dl className="project-dialog__data">
                  <div>
                    <dt>Rol</dt>
                    <dd>{selected.role}</dd>
                  </div>
                  <div>
                    <dt>Año</dt>
                    <dd>{selected.year}</dd>
                  </div>
                  <div>
                    <dt>Canal</dt>
                    <dd>{getChannel(categoryChannel[selected.category]).label}</dd>
                  </div>
                  <div>
                    <dt>Herramientas</dt>
                    <dd>
                      <ul className="tag-list">
                        {selected.tools.map((tool) => (
                          <li key={tool} className="tag">
                            {tool}
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <footer className="project-dialog__footer">
              <button type="button" className="btn" onClick={() => move(-1)}>
                <span aria-hidden="true">←</span> Anterior
              </button>
              <span className="project-dialog__index" aria-live="polite">
                {selectedIndex + 1} / {PROJECTS.length}
              </span>
              <button type="button" className="btn" onClick={() => move(1)}>
                Siguiente <span aria-hidden="true">→</span>
              </button>
            </footer>
          </div>
        )}
      </dialog>
    </div>
  );
}
