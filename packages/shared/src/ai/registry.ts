import type { AIProvider } from "./provider";

type ProviderConstructor = new (apiKey: string, model: string) => AIProvider;

const providers = new Map<string, ProviderConstructor>();

export function registerProvider(name: string, ctor: ProviderConstructor): void {
  providers.set(name, ctor);
}

export function getProvider(name: string, apiKey: string, model: string): AIProvider {
  const ctor = providers.get(name);
  if (!ctor) throw new Error(`Unknown AI provider: "${name}". Available: ${[...providers.keys()].join(", ")}`);
  return new ctor(apiKey, model);
}

export const PROMPT_SYSTEM = `
Eres un extractor de datos de publicaciones de compra/venta en Facebook.
Analiza el texto y responde SOLO con JSON válido, sin explicaciones.

Campos:
- title: nombre del producto (máx 80 chars). null si no identificas producto.
- price: número sin símbolos. null si no hay precio.
- currency: "Bs" o "USD". null si no se especifica.
- category: una de: casa, cocina, aseo, electronica, ropa, vehiculos, muebles, otros.
- description: texto completo del producto.
- contactPhone: número venezolano (0412, 0424, 0416, 0426). null si no aparece.
- contactName: nombre del vendedor. null si no aparece.
- location: ciudad o zona. null si no aparece.
- isAvailable: true/false. false si dice "vendido", "reservado", "dado".
- confidence: número del 0 al 1 indicando qué tan seguro estás de los datos extraídos.

Reglas:
- Si el texto no parece una publicación de venta, confidence < 0.3
- No inventes datos. Si no está en el texto, null.
- Precios en bolívares asume Bs, en dólares asume USD.
`;
