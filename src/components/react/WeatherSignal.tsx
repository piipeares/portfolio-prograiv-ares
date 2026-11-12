import { useCallback, useEffect, useRef, useState } from 'react';
import {
  EmptyWeatherError,
  fetchWeather,
  isCacheFresh,
  readWeatherCache,
  weatherNote,
  writeWeatherCache,
  type WeatherSnapshot,
} from '../../lib/weather';
import { $weatherStatus, commitWeather } from '../../stores/signal';

type Status = 'loading' | 'success' | 'error' | 'empty';

const REQUEST_TIMEOUT = 8000;

const formatHour = (timestamp: number): string =>
  new Date(timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

export default function WeatherSignal() {
  const [snapshot, setSnapshot] = useState<WeatherSnapshot | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [notice, setNotice] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  const request = useCallback(async (isRefresh: boolean) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    setNotice('');
    if (isRefresh) setRefreshing(true);
    else setStatus('loading');
    $weatherStatus.set('loading');

    try {
      if (!navigator.onLine) {
        throw new Error('Sin conexión a internet.');
      }

      const reading = await fetchWeather(controller.signal);
      if (!mounted.current) return;

      writeWeatherCache(reading);
      setSnapshot(reading);
      setStatus('success');
      commitWeather(reading);
    } catch (cause) {
      if (!mounted.current) return;

      if (cause instanceof EmptyWeatherError) {
        setStatus('empty');
        setNotice(cause.message);
        $weatherStatus.set('error');
        return;
      }

      const message =
        cause instanceof DOMException && cause.name === 'AbortError'
          ? 'La respuesta tardó más de 8 segundos.'
          : cause instanceof Error
            ? cause.message
            : 'No se pudo leer el clima.';

      const cached = readWeatherCache();
      if (cached) {
        setSnapshot(cached);
        setStatus('success');
        setNotice(`Sin conexión con Open-Meteo. Mostrando la última lectura guardada. (${message})`);
        commitWeather(cached);
      } else {
        setStatus('error');
        setNotice(message);
        $weatherStatus.set('error');
      }
    } finally {
      window.clearTimeout(timeout);
      if (mounted.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const cached = readWeatherCache();

    if (cached && isCacheFresh(cached)) {
      setSnapshot(cached);
      setStatus('success');
      commitWeather(cached);
    } else {
      void request(false);
    }

    return () => {
      mounted.current = false;
      abortRef.current?.abort();
    };
  }, [request]);

  return (
    <section
      className="weather panel"
      aria-label="Clima actual en Buenos Aires obtenido de Open-Meteo"
      aria-busy={refreshing}
    >
      <header className="weather__bar">
        <p className="weather__kicker">
          <span className="weather__dot" data-status={status} aria-hidden="true" />
          CLIMA EN VIVO
        </p>
        <p className="weather__source">OPEN-METEO · WMO</p>
      </header>

      <p className="sr-only" aria-live="polite">
        {status === 'loading' && 'Cargando el clima de Buenos Aires.'}
        {status === 'success' && snapshot && `Clima actualizado: ${snapshot.temperature} grados, ${snapshot.label}.`}
        {status === 'error' && 'No se pudo cargar el clima. Hay un botón para reintentar.'}
        {status === 'empty' && 'La API no devolvió datos actuales.'}
      </p>

      {status === 'loading' && (
        <div className="weather__skeleton" role="status" aria-label="Cargando clima">
          <span className="weather__skeleton-temp" />
          <span className="weather__skeleton-line" />
          <span className="weather__skeleton-line weather__skeleton-line--short" />
          <div className="weather__skeleton-grid">
            <span />
            <span />
            <span />
          </div>
          <p className="weather__skeleton-copy">Consultando Buenos Aires…</p>
        </div>
      )}

      {(status === 'error' || status === 'empty') && (
        <div className="weather__fallback" role="alert">
          <p className="weather__fallback-code">{status === 'empty' ? 'SIN DATOS' : 'SIN CONEXIÓN'}</p>
          <h3 className="weather__fallback-title">
            {status === 'empty' ? 'La API respondió sin datos de clima' : 'No pudimos leer el clima'}
          </h3>
          <p className="weather__fallback-text">
            {notice || 'Hubo un problema al consultar Open-Meteo.'} La escena sigue funcionando con el modo
            climático por defecto.
          </p>
          <button type="button" className="btn" onClick={() => void request(false)}>
            Reintentar <span aria-hidden="true">↻</span>
          </button>
        </div>
      )}

      {status === 'success' && snapshot && (
        <>
          <div className="weather__main">
            <p className="weather__temp">
              {snapshot.temperature}
              <span>°C</span>
            </p>
            <div className="weather__condition">
              <p className="weather__label">{snapshot.label}</p>
              <p className="weather__city">
                Buenos Aires · {snapshot.isDay ? 'día' : 'noche'}
              </p>
            </div>
          </div>

          <dl className="weather__metrics">
            <div>
              <dt>Sensación</dt>
              <dd>{snapshot.apparent}°</dd>
            </div>
            <div>
              <dt>Viento</dt>
              <dd>{snapshot.wind} km/h</dd>
            </div>
            <div>
              <dt>Humedad</dt>
              <dd>{snapshot.humidity}%</dd>
            </div>
            <div>
              <dt>Lluvia</dt>
              <dd>{snapshot.precipitation} mm</dd>
            </div>
          </dl>

          <p className="weather__note">{weatherNote[snapshot.mood]}</p>

          {notice && (
            <p className="weather__notice" role="status">
              {notice}
            </p>
          )}

          <footer className="weather__footer">
            <p className="weather__stamp">
              {snapshot.cached && <span className="weather__badge">CACHÉ</span>}
              Actualizado {formatHour(snapshot.fetchedAt)} · caché 10 min
            </p>
            <button
              type="button"
              className="weather__refresh"
              onClick={() => void request(true)}
              disabled={refreshing}
              aria-label="Actualizar datos del clima"
            >
              <span className={refreshing ? 'weather__refresh-icon is-spinning' : 'weather__refresh-icon'} aria-hidden="true">
                ↻
              </span>
              {refreshing ? 'Actualizando…' : 'Actualizar'}
            </button>
          </footer>
        </>
      )}
    </section>
  );
}
