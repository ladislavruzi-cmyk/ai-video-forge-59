import { createServerFn } from "@tanstack/react-start";
import { readIntegrationStatus } from "./providers.server";

/**
 * Serverové funkce, na které se později napojí skutečná AI API.
 * Klienti volají pouze tyto funkce, nikdy externí API přímo.
 */
export const getIntegrationStatus = createServerFn({ method: "GET" }).handler(async () => {
  return readIntegrationStatus();
});
