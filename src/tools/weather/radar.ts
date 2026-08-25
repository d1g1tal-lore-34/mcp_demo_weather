export function radarUrlFor(latitude: number, longitude: number): string {
    const encodedCoords = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    return `Radar loop for ${encodedCoords}: https://radar.weather.gov/ridge/standard/${encodedCoords}_loop.gif (canned demo output)`;
}
