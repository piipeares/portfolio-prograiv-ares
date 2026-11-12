import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { $audio } from '../../stores/signal';
import { startAmbient, stopAmbient } from '../../lib/ambient';

export default function SoundControl() {
  const state = useStore($audio);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const on = mounted && state === 'on';
  const unsupported = mounted && state === 'unsupported';

  return (
    <button
      type="button"
      className="sound"
      data-state={on ? 'on' : 'off'}
      aria-pressed={on}
      aria-label={on ? 'Silenciar sonido ambiental' : 'Activar sonido ambiental'}
      title={
        unsupported
          ? 'Este navegador no soporta Web Audio API'
          : on
            ? 'Sonido ambiental activo'
            : 'Activar sonido ambiental'
      }
      disabled={unsupported}
      onClick={() => (on ? stopAmbient() : void startAmbient())}
    >
      <span className="sound__icon" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="sound__text">
        <span className="sound__word">SONIDO</span>
        <span className="sound__value">{on ? 'ON' : 'OFF'}</span>
      </span>
    </button>
  );
}
