import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const here = dirname(fileURLToPath(import.meta.url));

export const SHARED_PRIVATE_KEY_PATH = resolve(here, "secret", "private.pem");

export function readSharedPrivateKey(): string {
  return readFileSync(SHARED_PRIVATE_KEY_PATH, "utf8");
}
