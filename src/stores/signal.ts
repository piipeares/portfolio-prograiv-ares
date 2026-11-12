import { atom } from 'nanostores';
import type { ChannelId } from '../data/profile';
import type { WeatherSnapshot } from '../lib/weather';

/**
 * Estado compartido entre islas de Astro.
 * Un solo store mantiene sincronizados el sintonizador, la obra,
 * el estado de cabecera y la escena 3D.
 */
export const $channel = atom<ChannelId>(0);

export const $weather = atom<WeatherSnapshot | null>(null);

export type DataStatus = 'idle' | 'loading' | 'success' | 'error';
export const $weatherStatus = atom<DataStatus>('idle');

export type AudioStatus = 'off' | 'on' | 'unsupported';
export const $audio = atom<AudioStatus>('off');

export function setChannel(value: number): void {
  $channel.set((value >= 0 && value <= 3 ? value : 0) as ChannelId);
}

export function commitWeather(snapshot: WeatherSnapshot): void {
  $weather.set(snapshot);
  $weatherStatus.set('success');
}
