import { APRSPacket } from './types';

/**
 * APRS (Automatic Packet Reporting System) and AX.25 Packet Protocol Service
 * Standard protocol for Amateur Radio packet communications.
 */
export class APRSService {
  private static messageSequence = 1;

  /**
   * Format decimal latitude/longitude into APRS format
   * e.g. -6.2088, 106.8456 -> "0612.53S", "10650.74E"
   */
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

  /**
   * Parse APRS latitude/longitude strings back to decimal coordinates
   */
  public static parseCoordinates(latStr: string, lonStr: string): { latitude: number; longitude: number } | null {
    try {
      if (latStr.length < 7 || lonStr.length < 8) return null;

      const latDeg = parseFloat(latStr.slice(0, 2));
      const latMin = parseFloat(latStr.slice(2, 7));
      const latHemi = latStr.slice(7, 8).toUpperCase();
      let latitude = latDeg + latMin / 60;
      if (latHemi === 'S') latitude = -latitude;

      const lonDeg = parseFloat(lonStr.slice(0, 3));
      const lonMin = parseFloat(lonStr.slice(3, 8));
      const lonHemi = lonStr.slice(8, 9).toUpperCase();
      let longitude = lonDeg + lonMin / 60;
      if (lonHemi === 'W') longitude = -longitude;

      return { latitude, longitude };
    } catch {
      return null;
    }
  }

  /**
   * Build directed APRS text message packet
   * Format: SOURCE-SSID>DEST,PATH::ADDRESSEE:Message text{msgNo
   */
  public static buildMessagePacket(params: {
    sourceCall: string;
    sourceSsid?: string;
    addresseeCall: string;
    addresseeSsid?: string;
    message: string;
    path?: string[];
  }): string {
    const src = `${params.sourceCall.toUpperCase()}${params.sourceSsid ? `-${params.sourceSsid}` : ''}`;
    const dest = 'APNGO1'; // Ngopi APRS Device ID
    const pathStr = (params.path && params.path.length > 0) ? `,${params.path.join(',')}` : ',WIDE1-1,WIDE2-1';

    const addrFull = `${params.addresseeCall.toUpperCase()}${params.addresseeSsid ? `-${params.addresseeSsid}` : ''}`;
    const addrPadded = addrFull.padEnd(9, ' ').slice(0, 9);

    const msgNo = (this.messageSequence++ % 9999).toString().padStart(4, '0');
    return `${src}>${dest}${pathStr}::${addrPadded}:${params.message}{${msgNo}`;
  }

  /**
   * Build APRS Position Report packet
   */
  public static buildPositionPacket(params: {
    sourceCall: string;
    sourceSsid?: string;
    latitude: number;
    longitude: number;
    symbol?: string; // default '-' (house/warkop) or 'k' (truck/mobile)
    comment?: string;
    path?: string[];
  }): string {
    const src = `${params.sourceCall.toUpperCase()}${params.sourceSsid ? `-${params.sourceSsid}` : ''}`;
    const dest = 'APNGO1';
    const pathStr = (params.path && params.path.length > 0) ? `,${params.path.join(',')}` : ',WIDE1-1,WIDE2-1';
    const { latStr, lonStr } = this.formatCoordinates(params.latitude, params.longitude);
    const sym = params.symbol || '-';
    const cmt = params.comment ? ` ${params.comment}` : '';

    return `${src}>${dest}${pathStr}:!${latStr}/${lonStr}${sym}${cmt}`;
  }

  /**
   * Build Emergency SOS APRS packet
   */
  public static buildEmergencyPacket(params: {
    sourceCall: string;
    sourceSsid?: string;
    latitude: number;
    longitude: number;
    emergencyText: string;
  }): string {
    const src = `${params.sourceCall.toUpperCase()}${params.sourceSsid ? `-${params.sourceSsid}` : ''}`;
    const dest = 'APNGO1';
    const pathStr = ',WIDE1-1,WIDE2-2';
    const { latStr, lonStr } = this.formatCoordinates(params.latitude, params.longitude);

    return `${src}>${dest}${pathStr}:!${latStr}/${lonStr}!EMERGENCY SOS: ${params.emergencyText}`;
  }

  /**
   * Parse incoming raw APRS packet
   */
  public static parsePacket(raw: string): APRSPacket | null {
    if (!raw || !raw.includes('>')) return null;

    try {
      const gtIdx = raw.indexOf('>');
      const colonIdx = raw.indexOf(':', gtIdx);
      if (gtIdx === -1 || colonIdx === -1) return null;

      const srcFull = raw.slice(0, gtIdx).trim();
      const headerRest = raw.slice(gtIdx + 1, colonIdx).trim();
      const payload = raw.slice(colonIdx + 1);

      const [srcCall, srcSsid] = srcFull.split('-');
      const headerParts = headerRest.split(',');
      const destCall = headerParts[0] || 'APRS';
      const path = headerParts.slice(1);

      // Detect packet type
      let type: APRSPacket['type'] = 'status';
      let messageText: string | undefined;
      let addressee: string | undefined;
      let latitude: number | undefined;
      let longitude: number | undefined;
      let comment: string | undefined;

      if (payload.startsWith(':')) {
        // Message packet :ADDRESSEE:Message{seq
        type = 'message';
        const msgColon = payload.indexOf(':', 1);
        if (msgColon !== -1) {
          addressee = payload.slice(1, msgColon).trim();
          let body = payload.slice(msgColon + 1);
          const curlyIdx = body.lastIndexOf('{');
          if (curlyIdx !== -1) {
            body = body.slice(0, curlyIdx);
          }
          messageText = body;
        }
      } else if (payload.startsWith('!') || payload.startsWith('=')) {
        // Position packet !DDMM.hhN/DDDMM.hhW
        type = 'position';
        const match = payload.match(/[!=](\d{4}\.\d{2}[NS])\/(\d{5}\.\d{2}[EW])(.)(.*)/);
        if (match) {
          const latPart = match[1]!;
          const lonPart = match[2]!;
          const coords = this.parseCoordinates(latPart, lonPart);
          if (coords) {
            latitude = coords.latitude;
            longitude = coords.longitude;
          }
          comment = (match[4] || '').trim();
          messageText = comment;
        }
      } else if (payload.startsWith('>')) {
        type = 'status';
        messageText = payload.slice(1).trim();
      } else {
        messageText = payload.trim();
      }

      return {
        sourceCall: (srcCall || '').toUpperCase(),
        sourceSsid: srcSsid || undefined,
        destCall,
        path,
        type,
        messageText,
        addressee,
        latitude,
        longitude,
        comment,
        raw,
      };
    } catch (err) {
      console.warn('[APRSService] Failed to parse packet:', err);
      return null;
    }
  }
}
