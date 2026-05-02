import { readFileSync, writeFileSync } from "fs";
import { logger } from "../lib/logger.js";

export interface WatchedUser {
  username: string;
  secUid: string;
  nickname: string;
  lastVideoCount: number;
  avatarUrl: string;
  followers: number;
  totalLikes: number;
  addedAt: number;
}

interface StoreData {
  watches: Record<string, WatchedUser>;
}

const STORE_PATH = "/tmp/tiktok-store.json";

function loadStore(): StoreData {
  try {
    return JSON.parse(readFileSync(STORE_PATH, "utf8")) as StoreData;
  } catch {
    return { watches: {} };
  }
}

function saveStore(data: StoreData): void {
  try {
    writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    logger.error({ err }, "Failed to save TikTok store");
  }
}

let store = loadStore();

export function getWatches(): WatchedUser[] {
  return Object.values(store.watches);
}

export function getWatch(username: string): WatchedUser | undefined {
  return store.watches[username.toLowerCase()];
}

export function addWatch(user: WatchedUser): void {
  store.watches[user.username.toLowerCase()] = user;
  saveStore(store);
}

export function removeWatch(username: string): boolean {
  const key = username.toLowerCase();
  if (!store.watches[key]) return false;
  delete store.watches[key];
  saveStore(store);
  return true;
}

export function updateVideoCount(username: string, count: number): void {
  const key = username.toLowerCase();
  if (store.watches[key]) {
    store.watches[key]!.lastVideoCount = count;
    saveStore(store);
  }
}

export function updateUserStats(
  username: string,
  followers: number,
  totalLikes: number,
  avatarUrl: string,
  nickname: string
): void {
  const key = username.toLowerCase();
  if (store.watches[key]) {
    const w = store.watches[key]!;
    w.followers = followers;
    w.totalLikes = totalLikes;
    w.avatarUrl = avatarUrl;
    w.nickname = nickname;
    saveStore(store);
  }
}
