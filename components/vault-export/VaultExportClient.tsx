"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const DEMO_CONFIG = {
  id: "demo-config",
  provider: "s3" as const,
  bucket_name: "pemabu-demo-vault",
  region: "us-east-1",
  endpoint_url: null,
  is_enabled: true,
  last_export_at: new Date().toISOString(),
  last_export_status: "success",
  last_export_error: null,
};

interface ExportConfig {
  id: string;
  provider: "s3" | "backblaze" | "nas";
  bucket_name: string | null;
  region: string | null;
  endpoint_url: string | null;
  is_enabled: boolean;
  last_export_at: string | null;
  last_export_status: string | null;
  last_export_error: string | null;
}

async function fetchConfig(): Promise<ExportConfig | null> {
  const res = await fetch("/api/vault-export/config");
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json() as { config: ExportConfig | null };
  return data.config;
}

async function saveConfig(body: Record<string, unknown>): Promise<ExportConfig> {
  const res = await fetch("/api/vault-export/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json() as { config: ExportConfig };
  return data.config;
}

async function deleteConfig(): Promise<void> {
  const res = await fetch("/api/vault-export/config", { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
}

export function VaultExportClient({ demo = false }: { demo?: boolean }) {
  const qc = useQueryClient();
  const configQuery = useQuery({
    queryKey: ["vault-export-config"],
    queryFn: fetchConfig,
    staleTime: 60_000,
    enabled: !demo,
  });
  const config = demo ? DEMO_CONFIG : configQuery.data;

  const [provider, setProvider] = useState<"s3" | "backblaze" | "nas">("s3");
  const [bucket, setBucket] = useState("");
  const [region, setRegion] = useState("us-east-1");
  const [endpoint, setEndpoint] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [nasPath, setNasPath] = useState("");
  const [editing, setEditing] = useState(false);

  const saveMutation = useMutation({
    mutationFn: saveConfig,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["vault-export-config"] });
      setEditing(false);
      setSecretKey("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteConfig,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["vault-export-config"] }),
  });

  function handleSave() {
    const body: Record<string, unknown> = { provider, is_enabled: true };
    if (provider !== "nas") {
      body.bucket_name = bucket;
      body.region = region;
      if (provider === "backblaze") body.endpoint_url = endpoint;
      body.credentials = { accessKeyId: accessKey, secretAccessKey: secretKey };
    } else {
      body.endpoint_url = nasPath;
      body.credentials = {};
    }
    saveMutation.mutate(body);
  }

  if (configQuery.isLoading) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      {config && !editing && (
        <div className="bg-white/5 rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${config.is_enabled ? "bg-emerald-400" : "bg-gray-500"}`} />
                <span className="text-sm font-medium text-white capitalize">{config.provider} export</span>
              </div>
              {config.bucket_name && <p className="text-xs text-gray-400 mt-1">{config.bucket_name} · {config.region}</p>}
              {config.endpoint_url && <p className="text-xs text-gray-400 mt-1">{config.endpoint_url}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setEditing(true); setProvider(config.provider); setBucket(config.bucket_name ?? ""); setRegion(config.region ?? "us-east-1"); setEndpoint(config.endpoint_url ?? ""); }} className="text-xs text-gray-400 hover:text-white transition-colors">Edit</button>
              <button onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} className="text-xs text-red-500 hover:text-red-400 transition-colors">Remove</button>
            </div>
          </div>
          {config.last_export_at && (
            <div>
              <p className="text-xs text-gray-500">Last export: {new Date(config.last_export_at).toLocaleDateString()}</p>
              {config.last_export_status === "error" && config.last_export_error && (
                <p className="text-xs text-red-400 mt-1">{config.last_export_error}</p>
              )}
              {config.last_export_status === "success" && (
                <p className="text-xs text-emerald-400 mt-1">Export successful</p>
              )}
            </div>
          )}
        </div>
      )}

      {(!config || editing) && (
        <div className="bg-white/5 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-medium text-gray-300">Configure Export Destination</h3>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Provider</label>
            <div className="flex gap-2">
              {(["s3", "backblaze", "nas"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setProvider(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${provider === p ? "bg-emerald-600 text-white" : "bg-white/10 text-gray-300 hover:bg-white/20"}`}
                >
                  {p === "s3" ? "AWS S3" : p === "backblaze" ? "Backblaze B2" : "NAS / SMB"}
                </button>
              ))}
            </div>
          </div>

          {provider !== "nas" && (
            <>
              <Field label="Bucket Name" value={bucket} onChange={setBucket} placeholder="my-pemabu-vault" />
              <Field label="Region" value={region} onChange={setRegion} placeholder="us-east-1" />
              {provider === "backblaze" && (
                <Field label="Endpoint URL" value={endpoint} onChange={setEndpoint} placeholder="s3.us-west-004.backblazeb2.com" />
              )}
              <Field label="Access Key ID" value={accessKey} onChange={setAccessKey} placeholder="AKIA…" />
              <Field label="Secret Access Key" value={secretKey} onChange={setSecretKey} placeholder="••••••••" type="password" />
            </>
          )}

          {provider === "nas" && (
            <Field label="SMB / NFS Share Path (informational only)" value={nasPath} onChange={setNasPath} placeholder="//192.168.1.10/backup" />
          )}

          {saveMutation.error && (
            <p className="text-sm text-red-400">{saveMutation.error.message}</p>
          )}

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saveMutation.isPending} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
              {saveMutation.isPending ? "Saving…" : "Save Configuration"}
            </button>
            {editing && (
              <button onClick={() => { setEditing(false); setSecretKey(""); }} className="px-4 py-2.5 bg-white/10 text-gray-300 text-sm rounded-lg hover:bg-white/20 transition-colors">Cancel</button>
            )}
          </div>
        </div>
      )}

      <div className="bg-white/5 rounded-xl p-5 space-y-2">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">About Data Vault Export</h3>
        <ul className="space-y-1.5 text-sm text-gray-400">
          <li>• Exports run every Sunday at 03:00 UTC via the Watcher Agent.</li>
          <li>• All data is AES-256-GCM encrypted before upload using your local vault key.</li>
          <li>• Only you can decrypt the backup — Pemabu never sees your data.</li>
          <li>• Includes holdings, signals, and allocation snapshots.</li>
        </ul>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2 bg-white/10 rounded-lg text-sm text-white border border-white/10 focus:outline-none focus:border-emerald-500 placeholder-gray-600" />
    </div>
  );
}
