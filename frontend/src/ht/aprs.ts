/**
 * APRS Packet helper for Frontend
 */

export class APRSFrontend {
  public static formatCoordinates(lat: number, lon: number): { latStr: string; lonStr: string } {
    const latHemi = lat >= 0 ? 'N' : 'S';
    const absLat = Math.abs(lat);
    const latDeg = Math.floor(absLat);
    const latMin = (absLat - latDeg) * 60;
    const latStr = `${latDeg.toString().padStart(2, '0')}${latMin.toFixed(2).padStart(5, '0')}${latHemi}`;

    const lonHemi = lon >= 0 ? 'E' : 'W';
    const absLon = Math.abs(lon);
    const lonDeg = Math.floor(absLon);
    const lonMin = (absLon - lonDeg) * 60;
    const lonStr = `${lonDeg.toString().padStart(3, '0')}${lonMin.toFixed(2).padStart(5, '0')}${lonHemi}`;

    return { latStr, lonStr };
  }

  public static buildAprsPacket(sourceCall: string, message: string, lat = -6.2088, lon = 106.8456): string {
    const { latStr, lonStr } = this.formatCoordinates(lat, lon);
    const cleanCall = (sourceCall || 'YD0NGO').toUpperCase();
    return `${cleanCall}-7>APNGO1,WIDE1-1:!${latStr}/${lonStr}-${message}`;
  }
}
