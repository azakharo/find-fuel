import type { Station, TileCoord } from '../types.js';

const API_BASE = 'https://sberazs.ru/api/stations/tile';

export type StationFetcher = (tile: TileCoord) => Promise<Station[]>;

export async function fetchStations(tile: TileCoord): Promise<Station[]> {
  const url = `${API_BASE}?z=${tile.z}&x=${tile.x}&y=${tile.y}`;
  const response = await fetch(url, {
    headers: {
      accept: '*/*',
      referer: 'https://sberazs.ru/',
    },
  });
  if (!response.ok) {
    throw new Error(`SberAZS API request failed: ${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as { stations: Station[] };
  return data.stations;
}
