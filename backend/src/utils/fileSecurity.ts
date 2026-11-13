import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const DANGEROUS_EXTENSIONS = new Set([
  '.php', '.phtml', '.php3', '.php4', '.php5', '.php7', '.php8', '.phar', '.inc',
  '.sh', '.bash', '.exe', '.bat', '.cmd', '.com', '.vbs', '.ps1', '.msi', '.dll',
  '.py', '.pl', '.cgi', '.jsp', '.asp', '.aspx', '.shtml', '.htaccess',
  '.html', '.htm', '.xhtml', '.svg', '.svgz', '.js', '.mjs', '.cjs', '.ts', '.jsx', '.tsx', '.xml',
]);

export const EXTENSION_TO_MIMES: Record<string, string[]> = {
  // Images
  '.jpg': ['image/jpeg', 'image/jpg'],
  '.jpeg': ['image/jpeg', 'image/jpg'],
  '.png': ['image/png'],
  '.webp': ['image/webp'],
  '.gif': ['image/gif'],
  '.bmp': ['image/bmp', 'image/x-ms-bmp'],
  '.heic': ['image/heic', 'image/heif'],
  '.heif': ['image/heif', 'image/heic'],

  // Documents & Text (no HTML/SVG)
  // Mobile DocumentPicker (Android/iOS) may send application/octet-stream for binary documents/archives;
  // magic-byte verification below still enforces genuine binary file headers.
  '.pdf': ['application/pdf', 'application/octet-stream'],
  '.doc': ['application/msword', 'application/octet-stream'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream'],
  '.xls': ['application/vnd.ms-excel', 'application/octet-stream'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'],
  '.ppt': ['application/vnd.ms-powerpoint', 'application/octet-stream'],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/octet-stream'],
  '.txt': ['text/plain'],
  '.csv': ['text/csv', 'text/plain', 'application/csv'],
  '.md': ['text/markdown', 'text/plain'],
  '.rtf': ['application/rtf', 'text/rtf'],
  '.json': ['application/json', 'text/plain'],

  // Audio
  '.mp3': ['audio/mpeg', 'audio/mp3'],
  '.m4a': ['audio/mp4', 'audio/m4a', 'audio/x-m4a'],
  '.webm': ['audio/webm', 'video/webm'],
  '.wav': ['audio/wav', 'audio/x-wav'],
  '.ogg': ['audio/ogg', 'application/ogg'],
  '.aac': ['audio/aac', 'audio/x-aac'],
  '.flac': ['audio/flac', 'audio/x-flac'],

  // Video
  '.mp4': ['video/mp4'],
  '.mov': ['video/quicktime'],
  '.avi': ['video/x-msvideo', 'video/avi'],
  '.mkv': ['video/x-matroska'],

  // Archives
  '.zip': ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'],
  '.rar': ['application/x-rar-compressed', 'application/vnd.rar', 'application/octet-stream'],
  '.7z': ['application/x-7z-compressed', 'application/octet-stream'],
  '.tar': ['application/x-tar'],
  '.gz': ['application/gzip', 'application/x-gzip'],
};

const TEXT_EXTENSIONS = new Set(['.txt', '.csv', '.md', '.json', '.rtf']);

export function validateExtensionAndMime(
  originalName: string,
  mimeType: string
): { valid: boolean; ext: string; reason?: string } {
  const base = path.basename(String(originalName || ''));
  if (!base || base.includes('\0')) {
    return { valid: false, ext: '', reason: 'Nama file tidak valid.' };
  }

  const ext = path.extname(base).toLowerCase();
  if (!ext) {
    return { valid: false, ext: '', reason: 'File harus memiliki ekstensi yang valid.' };
  }

  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return { valid: false, ext, reason: `File berekstensi '${ext}' dilarang demi keamanan!` };
  }

  const allowedMimes = EXTENSION_TO_MIMES[ext];
  if (!allowedMimes) {
    return { valid: false, ext, reason: `Ekstensi file '${ext}' tidak didukung.` };
  }

  const normalizedMime = (String(mimeType || '').toLowerCase().split(';')[0] ?? '').trim();
  if (!allowedMimes.includes(normalizedMime)) {
    return {
      valid: false,
      ext,
      reason: `Tipe MIME '${normalizedMime || 'unknown'}' tidak cocok dengan ekstensi '${ext}'.`,
    };
  }

  return { valid: true, ext };
}

export function verifyMagicBytes(buffer: Buffer, ext: string): { valid: boolean; reason?: string } {
  if (!buffer || buffer.length === 0) {
    return { valid: false, reason: 'File kosong tidak diizinkan.' };
  }

  const hex = (start: number, len: number) =>
    buffer.subarray(start, start + len).toString('hex').toLowerCase();
  const ascii = (start: number, len: number) =>
    buffer.subarray(start, start + len).toString('ascii');

  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return buffer.length >= 3 && hex(0, 3) === 'ffd8ff'
        ? { valid: true }
        : { valid: false, reason: 'Signature file JPEG tidak valid.' };
    case '.png':
      return buffer.length >= 8 && hex(0, 8) === '89504e470d0a1a0a'
        ? { valid: true }
        : { valid: false, reason: 'Signature file PNG tidak valid.' };
    case '.gif':
      return buffer.length >= 6 && (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a')
        ? { valid: true }
        : { valid: false, reason: 'Signature file GIF tidak valid.' };
    case '.webp':
      return buffer.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP'
        ? { valid: true }
        : { valid: false, reason: 'Signature file WebP tidak valid.' };
    case '.bmp':
      return buffer.length >= 2 && ascii(0, 2) === 'BM'
        ? { valid: true }
        : { valid: false, reason: 'Signature file BMP tidak valid.' };
    case '.pdf':
      return buffer.length >= 5 && ascii(0, 5) === '%PDF-'
        ? { valid: true }
        : { valid: false, reason: 'Signature file PDF tidak valid.' };
    case '.zip':
    case '.docx':
    case '.xlsx':
    case '.pptx':
      return buffer.length >= 4 &&
        (hex(0, 4) === '504b0304' || hex(0, 4) === '504b0506' || hex(0, 4) === '504b0708')
        ? { valid: true }
        : { valid: false, reason: `Signature arsip/dokumen '${ext}' tidak valid.` };
    case '.doc':
    case '.xls':
    case '.ppt':
      return buffer.length >= 8 && hex(0, 8) === 'd0cf11e0a1b11ae1'
        ? { valid: true }
        : { valid: false, reason: `Signature dokumen '${ext}' tidak valid.` };
    case '.mp4':
    case '.mov':
    case '.m4a':
    case '.heic':
    case '.heif':
      return buffer.length >= 8 && ascii(4, 4) === 'ftyp'
        ? { valid: true }
        : { valid: false, reason: `Signature media '${ext}' tidak valid.` };
    case '.webm':
    case '.mkv':
      return buffer.length >= 4 && hex(0, 4) === '1a45dfa3'
        ? { valid: true }
        : { valid: false, reason: `Signature media '${ext}' tidak valid.` };
    case '.wav':
    case '.avi':
      return buffer.length >= 4 && ascii(0, 4) === 'RIFF'
        ? { valid: true }
        : { valid: false, reason: `Signature media '${ext}' tidak valid.` };
    case '.ogg':
      return buffer.length >= 4 && ascii(0, 4) === 'OggS'
        ? { valid: true }
        : { valid: false, reason: 'Signature audio OGG tidak valid.' };
    case '.flac':
      return buffer.length >= 4 && ascii(0, 4) === 'fLaC'
        ? { valid: true }
        : { valid: false, reason: 'Signature audio FLAC tidak valid.' };
    case '.mp3': {
      const b0 = buffer[0] ?? 0;
      const b1 = buffer[1] ?? 0;
      return buffer.length >= 3 &&
        (ascii(0, 3) === 'ID3' || (b0 === 0xff && (b1 & 0xe0) === 0xe0))
        ? { valid: true }
        : { valid: false, reason: 'Signature audio MP3 tidak valid.' };
    }
    case '.rar':
      return buffer.length >= 4 && ascii(0, 4) === 'Rar!'
        ? { valid: true }
        : { valid: false, reason: 'Signature arsip RAR tidak valid.' };
    case '.7z':
      return buffer.length >= 6 && hex(0, 6) === '377abcaf271c'
        ? { valid: true }
        : { valid: false, reason: 'Signature arsip 7z tidak valid.' };
    case '.gz':
      return buffer.length >= 2 && hex(0, 2) === '1f8b'
        ? { valid: true }
        : { valid: false, reason: 'Signature arsip GZ tidak valid.' };
    default:
      if (TEXT_EXTENSIONS.has(ext)) {
        if (buffer.includes(0x00)) {
          return { valid: false, reason: 'File teks tidak boleh berisi data biner (null byte).' };
        }
        const sample = buffer.subarray(0, 4096).toString('utf8').toLowerCase();
        if (sample.includes('<script') || sample.includes('<!doctype html') || sample.includes('<html')) {
          return { valid: false, reason: 'Konten HTML/script aktif tidak diizinkan.' };
        }
        return { valid: true };
      }
      return { valid: true };
  }
}

export function verifyUploadedFileSignature(filePath: string, ext: string): { valid: boolean; reason?: string } {
  const fd = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(4096);
    const bytesRead = fs.readSync(fd, header, 0, 4096, 0);
    return verifyMagicBytes(header.subarray(0, bytesRead), ext);
  } finally {
    fs.closeSync(fd);
  }
}

export function generateSafeFilename(ext: string): string {
  const cleanExt = path.extname(ext).replace(/[^.A-Za-z0-9]/g, '').toLowerCase().slice(0, 12);
  return `${Date.now()}-${crypto.randomUUID()}${cleanExt}`;
}

export function resolveSafeChildPath(baseDir: string, unsafeSegment: string): string | null {
  if (!unsafeSegment || unsafeSegment.includes('\0') || unsafeSegment.includes('/') || unsafeSegment.includes('\\')) {
    return null;
  }
  if (unsafeSegment === '.' || unsafeSegment === '..' || unsafeSegment.includes('..')) {
    return null;
  }
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(resolvedBase, unsafeSegment);
  if (!resolvedTarget.startsWith(resolvedBase + path.sep)) {
    return null;
  }
  return resolvedTarget;
}

