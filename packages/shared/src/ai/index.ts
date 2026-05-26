export * from "./provider";
export * from "./registry";
export * from "./openrouter";

import { registerProvider } from "./registry";
import { OpenRouterProvider } from "./openrouter";

registerProvider("openrouter", OpenRouterProvider);
