import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { useStore } from '@nanostores/react';
import { CHANNELS, getChannel, projectsForChannel } from '../../data/profile';
import { $audio, $channel, setChannel } from '../../stores/signal';
import { resumeOnInteraction } from '../../lib/ambient';

const METER_BARS = Array.from({ length: 32 }, (_, index) => index);

export default function SignalDial() {
  const channel = useStore($channel);
  const audio = useStore($audio);
  const active = getChannel(channel);
  const count = projectsForChannel(channel).length;

  const [isMounted, setIsMounted] = useState(false);
  const wroteUrl = useRef(false);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  // Deep link: /?canal=2
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('canal');
    const parsed = Number(param);
    if (param !== null && Number.isInteger(parsed) && parsed >= 0 && parsed <= 3) {
      setChannel(parsed);
    }
    setIsMounted(true);
  }, []);

  // Mantiene el canal en la URL para poder compartir un estado de la pieza.
  useEffect(() => {
    if (!isMounted) return;
    if (!wroteUrl.current) {
      wroteUrl.current = true;
      return;
    }
    const url = new URL(window.location.href);
    if (channel === 0) url.searchParams.delete('canal');
    else url.searchParams.set('canal', String(channel));
    window.history.replaceState({}, '', url);
  }, [channel, isMounted]);

  const select = (value: number, focus = false) => {
    setChannel(value);
    resumeOnInteraction();
    if (focus) buttons.current[value]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (channel + 1) % CHANNELS.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (channel - 1 + CHANNELS.length) % CHANNELS.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = CHANNELS.length - 1;
    if (next === null) return;
    event.preventDefault();
    select(next, true);
  };

  return (
    <div
      className="dial panel"
      role="group"
      aria-labelledby="dial-title"
      style={{ '--dial-accent': channel === 3 ? '#22d3ee' : channel === 2 ? '#a78bfa' : '#f0abfc' } as CSSProperties}
    >
      <div className="dial__head">
        <div>
          <p className="dial__kicker">
            <span className="dial__live" aria-hidden="true" />
            SINTONIZADOR
          </p>
          <p className="dial__title" id="dial-title">
            Elegí un canal
          </p>
        </div>
        <div className="dial__readout" aria-hidden="true">
          <span className="dial__readout-code">{active.code}</span>
          <span className="dial__readout-name">{active.short}</span>
        </div>
      </div>

      <div
        className="dial__channels"
        role="radiogroup"
        aria-label="Filtrar proyectos por canal"
        aria-describedby="dial-hint"
        onKeyDown={onKeyDown}
      >
        {CHANNELS.map((item) => {
          const isActive = item.id === channel;
          const total = projectsForChannel(item.id).length;
          return (
            <button
              key={item.id}
              ref={(node) => {
                buttons.current[item.id] = node;
              }}
              type="button"
              role="radio"
              aria-checked={isActive}
              tabIndex={isActive ? 0 : -1}
              className={`dial__channel${isActive ? ' is-active' : ''}`}
              onClick={() => select(item.id)}
            >
              <span className="dial__channel-top">
                <span className="dial__channel-code">{item.code}</span>
                <span className="dial__channel-freq">{item.frequency} MHz</span>
              </span>
              <span className="dial__channel-label">{item.label}</span>
              <span className="dial__channel-meta">
                <span>{item.description}</span>
                <span className="dial__channel-count">
                  {total} {total === 1 ? 'pieza' : 'piezas'}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="dial__meter" data-audio={audio === 'on' ? 'on' : 'off'} aria-hidden="true">
        {METER_BARS.map((bar) => (
          <span
            key={bar}
            className="dial__bar"
            style={{ '--i': bar } as CSSProperties}
          />
        ))}
      </div>

      <p className="dial__hint" id="dial-hint">
        <span aria-hidden="true">← →</span> cambia el canal y el sonido. Ajusta la escena 3D y filtra la obra.
      </p>

      <p className="sr-only" aria-live="polite">
        {`Canal ${active.label}. ${count} ${count === 1 ? 'pieza disponible' : 'piezas disponibles'}.`}
      </p>
    </div>
  );
}
