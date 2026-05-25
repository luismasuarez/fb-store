export function getWhatsAppLink(phone: string, product: string, appName: string): string {
  const message = `Hola, vi tu *${product}* en *${appName}*. ¿Está disponible todavía?`;
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  const fullPhone = cleanPhone.startsWith("58") ? cleanPhone : `58${cleanPhone}`;
  return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
}
