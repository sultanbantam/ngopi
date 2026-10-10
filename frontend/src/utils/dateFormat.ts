/**
 * Standarisasi Format Tanggal & Waktu (UX-02):
 * - Hari ini: 06:22
 * - Kemarin: Kemarin, 06:22
 * - Lebih dari 2 hari: 29 Sep, 06:22
 */
export const formatMessageTime = (dateInput: string | number | Date | null | undefined): string => {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const timeStr = `${hours}:${minutes}`;

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return timeStr;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return `Kemarin, ${timeStr}`;
  }

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const day = date.getDate();
  const month = MONTHS[date.getMonth()];
  return `${day} ${month}, ${timeStr}`;
};

export const formatChatListTime = (dateInput: string | number | Date | null | undefined): string => {
  return formatMessageTime(dateInput);
};
