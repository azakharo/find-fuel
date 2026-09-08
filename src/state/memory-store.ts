export interface StateStore {
  getState(stationId: string, fuelType: string): boolean | null;
  setState(stationId: string, fuelType: string, available: boolean, updatedAt: string): void;
  close(): void;
}

export class MemoryStateStore implements StateStore {
  private readonly states = new Map<string, boolean>();

  getState(stationId: string, fuelType: string): boolean | null {
    return this.states.get(`${stationId}:${fuelType}`) ?? null;
  }

  setState(stationId: string, fuelType: string, available: boolean, _updatedAt: string): void {
    this.states.set(`${stationId}:${fuelType}`, available);
  }

  close(): void {}
}
