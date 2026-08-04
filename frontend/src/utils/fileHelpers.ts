export const getMimeType = (fileName?: string, fallbackMime?: string): string => {
  if (fallbackMime && fallbackMime !== 'application/octet-stream' && fallbackMime.includes('/')) {
    return fallbackMime;
  }

  const ext = fileName ? fileName.slice(fileName.lastIndexOf('.')).toLowerCase() : '';
  switch (ext) {
    // Images
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.bmp':
      return 'image/bmp';
    case '.svg':
      return 'image/svg+xml';
    case '.heic':
      return 'image/heic';
    case '.heif':
      return 'image/heif';

    // Documents & Text
    case '.pdf':
      return 'application/pdf';
    case '.doc':
      return 'application/msword';
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.xls':
      return 'application/vnd.ms-excel';
    case '.xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case '.ppt':
      return 'application/vnd.ms-powerpoint';
    case '.pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case '.txt':
      return 'text/plain';
    case '.csv':
      return 'text/csv';
    case '.json':
      return 'application/json';
    case '.rtf':
      return 'application/rtf';
    case '.zip':
      return 'application/zip';
    case '.rar':
      return 'application/x-rar-compressed';
    case '.7z':
      return 'application/x-7z-compressed';

    // Audio
    case '.mp3':
      return 'audio/mpeg';
    case '.m4a':
      return 'audio/m4a';
    case '.webm':
      return 'audio/webm';
    case '.wav':
      return 'audio/wav';
    case '.ogg':
      return 'audio/ogg';

    // Video
    case '.mp4':
      return 'video/mp4';
    case '.mov':
      return 'video/quicktime';
    case '.avi':
      return 'video/x-msvideo';

    default:
      return fallbackMime && fallbackMime.includes('/') ? fallbackMime : 'application/octet-stream';
  }
};
