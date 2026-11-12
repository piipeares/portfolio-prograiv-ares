import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { $weather, $weatherStatus } from '../../stores/signal';

export default function SignalStatus() {
  const storedWeather = useStore($weather);
  const status = useStore($weatherStatus);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  // Mismo HTML en servidor y en la primera pasada de hidratación.
  const weather = hydrated ? storedWeather : null;

  return (
    <p className="signal-status">
      <span
        className="signal-status__dot"
        data-mood={weather?.mood ?? 'idle'}
        data-status={status}
        aria-hidden="true"
      />
      <span className="signal-status__channel" aria-hidden="true">
        BUE
      </span>
      <span className="signal-status__sep" aria-hidden="true">
        ·
      </span>
      <span className="signal-status__temp" aria-hidden="true">
        {weather ? `${weather.temperature}°C` : '—°C'}
      </span>
      <span className="sr-only">
        {weather
          ? `Clima en Buenos Aires: ${weather.temperature} grados, ${weather.label}.`
          : 'Clima en Buenos Aires sin datos todavía.'}
      </span>
    </p>
  );
}
