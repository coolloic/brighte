// Server-only public API of the chat feature: settings from env, personas (system prompts), the rate
// limiter and the route handler. Importing this from a Client Component fails the build.
import "server-only";

export { chatConfig, type ChatConfig } from "./config";
export { handleChat, type ChatHandlerDeps } from "./handle-chat";
export { getPersona, type Persona } from "./personas";
export { createRateLimiter, type RateLimitResult } from "./rate-limit";
