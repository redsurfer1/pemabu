import { execFile } from "node:child_process";
import { mkdir, readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const BACKUP_DIR = process.env.VAULT_BACKUP_DIR || "/backups";
const RETENTION_DAYS = Number(process.env.VAULT_BACKUP_RETENTION_DAYS) || 30;

export interface BackupResult {
  file: string;
  sizeBytes: number;
  ok: true;
}

export async function runVaultBackup(): Promise<BackupResult> {
  const dbUrl = process.env.LOCAL_DB_URL;
  if (!dbUrl) throw new Error("LOCAL_DB_URL is not set — cannot run vault backup");

  await mkdir(BACKUP_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = join(BACKUP_DIR, `vault-${timestamp}.pgdump`);

  const { stdout, stderr } = await execFileAsync("pg_dump", [
    "--dbname",
    dbUrl,
    "--format=custom",
    "--compress=9",
    "--file",
    outFile,
    "--no-owner",
    "--no-acl",
    "--verbose",
  ]);
  const lines = stderr.split("\n").filter((l) => l.trim());
  for (const line of lines) {
    console.log(`[pg_dump] ${line}`);
  }

  const sizeBytes = Number((await stat(outFile)).size ?? 0);
  console.log(`[backup] created ${outFile} (${(sizeBytes / 1024 / 1024).toFixed(2)} MB)`);

  await pruneOldBackups();

  return { file: outFile, sizeBytes, ok: true };
}

async function pruneOldBackups(): Promise<void> {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let entries;
  try {
    entries = await readdir(BACKUP_DIR, { withFileTypes: true });
  } catch {
    return;
  }
  const removed: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.startsWith("vault-") || !entry.name.endsWith(".pgdump")) continue;
    const fullPath = join(BACKUP_DIR, entry.name);
    let statResult;
    try {
      statResult = await stat(fullPath);
    } catch {
      continue;
    }
    if (statResult.mtimeMs < cutoff) {
      await unlink(fullPath);
      removed.push(entry.name);
    }
  }
  if (removed.length > 0) {
    console.log(`[backup] pruned ${removed.length} old backup(s): ${removed.join(", ")}`);
  }
}
