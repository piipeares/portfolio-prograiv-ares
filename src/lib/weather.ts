export type WeatherMood = 'clear' | 'cloud' | 'fog' | 'rain' | 'snow' | 'storm';

export interface WeatherSnapshot {
  city: string;
  temperature: number;
  apparent: number;
  humidity: number;
  wind: number;
  precipitation: number;
  isDay: boolean;
  code: number;
  label: string;
  mood: WeatherMood;
  fetchedAt: number;
  cached: boolean;
}

export const WEATHER_CACHE_KEY = 'senal:weather:v1';
export const WEATHER_CACHE_TTL = 10 * 60 * 1000;

const API_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=-34.6037&longitude=-58.3816&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&timezone=America%2FArgentina%2FBuenos_Aires&forecast_days=1';

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    apparent_temperature?: number;
    is_day?: number;
    precipitation?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
}

const WEATHER_CODES: Record<number, { label: string; mood: WeatherMood }> = {
  0: { label: 'Cielo despejado', mood: 'clear' },
  1: { label: 'Mayormente despejado', mood: 'clear' },
  2: { label: 'Parcialmente nublado', mood: 'cloud' },
  3: { label: 'Nublado', mood: 'cloud' },
  45: { label: 'Niebla', mood: 'fog' },
  48: { label: 'Niebla con escarcha', mood: 'fog' },
  51: { label: 'Llovizna leve', mood: 'rain' },
  53: { label: 'Llovizna', mood: 'rain' },
  55: { label: 'Llovizna intensa', mood: 'rain' },
  56: { label: 'Llovizna helada', mood: 'rain' },
  57: { label: 'Llovizna helada intensa', mood: 'rain' },
  61: { label: 'Lluvia leve', mood: 'rain' },
  63: { label: 'Lluvia', mood: 'rain' },
  65: { label: 'Lluvia intensa', mood: 'rain' },
  66: { label: 'Lluvia helada', mood: 'rain' },
  67: { label: 'Lluvia helada intensa', mood: 'rain' },
  71: { label: 'Nevada leve', mood: 'snow' },
  73: { label: 'Nevada', mood: 'snow' },
  75: { label: 'Nevada intensa', mood: 'snow' },
  77: { label: 'Granos de nieve', mood: 'snow' },
  80: { label: 'Chubascos leves', mood: 'rain' },
  81: { label: 'Chubascos', mood: 'rain' },
  82: { label: 'Chubascos fuertes', mood: 'rain' },
  85: { label: 'Chubascos de nieve', mood: 'snow' },
  86: { label: 'Chubascos de nieve fuertes', mood: 'snow' },
  95: { label: 'Tormenta', mood: 'storm' },
  96: { label: 'Tormenta con granizo', mood: 'storm' },
  99: { label: 'Tormenta fuerte con granizo', mood: 'storm' },
};

export const describeWeather = (code: number): { label: string; mood: WeatherMood } =>
  WEATHER_CODES[code] ?? { label: 'Condición no informada', mood: 'cloud' };

export class EmptyWeatherError extends Error {
  constructor() {
    super('La API respondió sin datos meteorológicos actuales.');
    this.name = 'EmptyWeatherError';
  }
}

export async function fetchWeather(signal?: AbortSignal): Promise<WeatherSnapshot> {
  const response = await fetch(API_URL, {
    signal,
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo respondió ${response.status}.`);
  }

  const data = (await response.json()) as OpenMeteoResponse;
  const current = data.current;

  if (!current || typeof current.temperature_2m !== 'number') {
    throw new EmptyWeatherError();
  }

  const code = typeof current.weather_code === 'number' ? current.weather_code : 0;
  const { label, mood } = describeWeather(code);

  return {
    city: 'Buenos Aires',
    temperature: Math.round(current.temperature_2m),
    apparent: Math.round(current.apparent_temperature ?? current.temperature_2m),
    humidity: Math.round(current.relative_humidity_2m ?? 0),
    wind: Math.round(current.wind_speed_10m ?? 0),
    precipitation: Number((current.precipitation ?? 0).toFixed(1)),
    isDay: current.is_day !== 0,
    code,
    label,
    mood,
    fetchedAt: Date.now(),
    cached: false,
  };
}

const isValidSnapshot = (value: unknown): value is WeatherSnapshot => {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as WeatherSnapshot;
  return (
    typeof snapshot.temperature === 'number' &&
    typeof snapshot.fetchedAt === 'number' &&
    typeof snapshot.mood === 'string'
  );
};

export function readWeatherCache(): WeatherSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidSnapshot(parsed)) {
      window.sessionStorage.removeItem(WEATHER_CACHE_KEY);
      return null;
    }
    return { ...parsed, cached: true };
  } catch {
    return null;
  }
}

export function writeWeatherCache(snapshot: WeatherSnapshot): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ ...snapshot, cached: false }));
  } catch {
    // sessionStorage puede estar bloqueado por privacidad. La app sigue funcionando sin caché.
  }
}

export const isCacheFresh = (snapshot: WeatherSnapshot | null): boolean =>
  Boolean(snapshot && Date.now() - snapshot.fetchedAt < WEATHER_CACHE_TTL);

export const weatherNote: Record<WeatherMood, string> = {
  clear: 'La escena respira en violeta y el anillo gira a pulso lento.',
  cloud: 'La paleta baja a índigo y el movimiento se vuelve más denso.',
  fog: 'La escena pierde bordes: el grano y la opacidad ganan protagonismo.',
  rain: 'El pulso se acelera y la paleta se corre hacia el azul frío.',
  snow: 'El entorno se aquieta: luz blanca, rotación mínima.',
  storm: 'La escena entra en alerta: rojo, jitter y máxima velocidad.',
};
