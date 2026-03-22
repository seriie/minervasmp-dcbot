import { readFileSync, writeFileSync } from "fs";
import path from "path";

const configPath = path.resolve("src/config/bot.json");

export function getConfig() {
  return JSON.parse(readFileSync(configPath, "utf8"));
}

export function saveConfig(newConfig) {
  writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
}