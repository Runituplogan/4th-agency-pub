export function toInternationalFormat(phone: string): string {
  return phone.startsWith('0')
    ? '+234' + phone.slice(1)
    : phone.startsWith('+')
      ? phone
      : '+234' + phone;
}
