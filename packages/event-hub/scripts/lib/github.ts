/**
 * Shared `gh` CLI helpers for the workflows that file issues.
 */
import { execFileSync } from "node:child_process";

export const gh = (args: string[]): string =>
  execFileSync("gh", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();

export function ensureLabel(name: string, color: string, description: string): void {
  gh(["label", "create", name, "--force", "--color", color, "--description", description]);
}
