// deno-lint-ignore-file no-explicit-any

import * as fs from "jsr:@std/fs";
import * as yaml from "jsr:@std/yaml";
import * as flags from "jsr:@std/flags";

const MANIFEST_DIR = "manifests/";
const CONFIG_PATH = "reconcile.conf.yaml";

// ====

async function main() {
  if (isApplyMode()) {
    console.error("APPLYING");
  } else {
    console.error(`dry run`);
  }

  await assertConfigKindsExhaustive();

  const config = loadConfig();
  const namespaces = await getKubernetesNamespaces();

  // 監視対象の namespace だけを取り出す
  const controlNamespaces = [];
  for (const ns of namespaces) {
    if (config.excludeNamespaces.includes(ns)) {
      continue;
    }
    controlNamespaces.push(ns);
  }

  const clusterScopedAPIResources = new Set(
    await getKubernetesClusterScopedAPIResources()
  );

  let serverSideNamespacedResources: (namespacedResource | null)[] = [];
  let serverSideClusterScopedResources: (clusterScopedResource | null)[] = [];

  // Namespaced なリソースの一覧
  for (const ns of controlNamespaces) {
    for (const fullKind of config.controlKinds) {
      if (clusterScopedAPIResources.has(fullKind)) {
        continue;
      }

      const resources = await getKubernetesNamespacedResources(fullKind, ns);
      // Kubernetes によって自動生成されるリソースを除外
      for (const r of resources.items) {
        if (
          r.metadata.name === "kube-root-ca.crt" &&
          r.kind === "ConfigMap" &&
          r.apiVersion === "v1"
        ) {
          continue;
        }
        // Kubernetes によって自動生成されるリソースを除外
        if (
          r.metadata.name === "kubernetes" &&
          r.metadata.namespace === "default" &&
          r.kind === "Service" &&
          r.apiVersion == "v1"
        ) {
          continue;
        }

        serverSideNamespacedResources.push({
          name: r.metadata.name,
          namespace: r.metadata.namespace,
          kind: r.kind,
          apiVersion: r.apiVersion,
        });
      }
    }
  }
  // Cluster-scoped なリソースの一覧
  for (const fullKind of config.controlKinds) {
    if (!clusterScopedAPIResources.has(fullKind)) {
      continue;
    }

    const resources = await getKubernetesClsuterScopedResources(fullKind);
    for (const r of resources.items) {
      // 監視対象外の namespace なので除外
      if (
        r.kind === "Namespace" &&
        r.apiVersion === "v1" &&
        config.excludeNamespaces.includes(r.metadata.name)
      ) {
        continue;
      }
      // default namespace そのものはマニフェストによって管理しないので除外
      if (
        r.kind === "Namespace" &&
        r.apiVersion === "v1" &&
        r.metadata.name === "default"
      ) {
        continue;
      }

      serverSideClusterScopedResources.push({
        name: r.metadata.name,
        kind: r.kind,
        apiVersion: r.apiVersion,
      });
    }
  }

  // ローカルのマニフェストにあるものを消していく
  // つまり、残ったものが削除対象となる
  const manifests = await listDeclaredManifests();
  for (const manifest of manifests) {
    const i = serverSideClusterScopedResources.findIndex(
      (sr) =>
        sr?.apiVersion === manifest.apiVersion &&
        sr.kind === manifest.kind &&
        sr.name === manifest.metadata?.name
    );
    if (i >= 0) {
      serverSideClusterScopedResources[i] = null;
      continue;
    }
    const ii = serverSideNamespacedResources.findIndex(
      (sr) =>
        sr?.apiVersion === manifest.apiVersion &&
        sr.kind === manifest.kind &&
        sr.name === manifest.metadata?.name &&
        sr.namespace === manifest.metadata?.namespace
    );
    if (ii >= 0) {
      serverSideNamespacedResources[ii] = null;
      continue;
    }
  }
  serverSideClusterScopedResources = serverSideClusterScopedResources.filter(
    (v) => v !== null
  );
  serverSideNamespacedResources = serverSideNamespacedResources.filter(
    (v) => v !== null
  );

  // サーバにだけあるリソースを削除する
  for (const r of serverSideClusterScopedResources) {
    await deleteKubernetesNamespacedResource(
      `${r!.apiVersion}:${r!.kind}`,
      r!.name,
      "default"
    );
  }
  for (const r of serverSideNamespacedResources) {
    await deleteKubernetesNamespacedResource(
      `${r!.apiVersion}:${r!.kind}`,
      r!.name,
      r!.namespace
    );
  }

  // 最後にマニフェストを apply する
  await applyKubernetesManifets();
}

// ====

/** --plan なのか --apply なのかを判定する */
function isApplyMode(): boolean {
  const { plan, apply } = flags.parse(Deno.args);
  if (plan) {
    return false;
  }

  if (apply) {
    return true;
  }

  // どちらも指定されていなければ plan
  return false;
}

interface namespacedResource {
  name: string;
  namespace: string;
  apiVersion: string;
  kind: string;
}

interface clusterScopedResource {
  name: string;
  apiVersion: string;
  kind: string;
}

/** kubernetes のマニフェスト */
interface kubernetesGenericManifest {
  apiVersion: string;
  kind: string;
  metadata?: kubernetesMetadata;
}

interface kubernetesMetadata {
  name: string;
  namespace?: string;
}

function isManifest(arg: any): arg is kubernetesGenericManifest {
  try {
    if (typeof arg["apiVersion"] !== "string") {
      return false;
    }
    if (typeof arg["kind"] !== "string") {
      return false;
    }
    return true;
  } catch (_) {
    return false;
  }
}

function isManifestList(arg: any): arg is kubernetesGenericManifest[] {
  try {
    for (const v of arg) {
      if (!isManifest(v)) {
        return false;
      }
    }
    return true;
  } catch (_) {
    return false;
  }
}

async function listDeclaredManifests(): Promise<kubernetesGenericManifest[]> {
  const ret = [];

  for (const p of await listDeclaredManifestsPaths()) {
    const mt = await Deno.readTextFile(p);
    const ms = yaml.parseAll(mt);
    if (!isManifestList(ms)) {
      throw new TypeError(`${p}の形式がおかしい`);
    }
    ret.push(...ms);
  }

  return ret;
}

/** 設定した kinds に存在しないマニフェストがないかどうかチェックする */
async function assertConfigKindsExhaustive(): Promise<void> {
  const c = loadConfig();
  const configuredKinds = new Set([...c.controlKinds, ...c.excludeKinds]);

  const manifests = await listDeclaredManifests();
  for (const m of manifests) {
    if (!configuredKinds.has(`${m.apiVersion}:${m.kind}`)) {
      throw new Error(`設定されていないKind ${m.apiVersion}:${m.kind}`);
    }
  }
}

async function listDeclaredManifestsPaths(): Promise<string[]> {
  const paths: string[] = [];

  for await (const entry of fs.walk(MANIFEST_DIR)) {
    if (!entry.isFile) {
      continue;
    }
    if (!entry.name.endsWith(".yaml") && !entry.name.endsWith(".yml")) {
      continue;
    }
    paths.push(entry.path);
  }

  return paths;
}

interface config {
  controlKinds: string[];
  excludeKinds: string[];
  excludeNamespaces: string[];
}

function isConfig(arg: any): arg is config {
  const isStringArray = (arg: any): boolean => {
    if (!Array.isArray(arg)) {
      return false;
    }
    if (!arg.every((v) => typeof v === "string")) {
      return false;
    }
    return true;
  };

  try {
    if (!isStringArray(arg["controlKinds"])) {
      return false;
    }
    if (!isStringArray(arg["excludeKinds"])) {
      return false;
    }
    if (!isStringArray(arg["excludeNamespaces"])) {
      return false;
    }
    return true;
  } catch (_) {
    return false;
  }
}

let __global_config: config | null = null;
function loadConfig(): config {
  if (__global_config) {
    return __global_config;
  }

  const t = Deno.readTextFileSync(CONFIG_PATH);
  const c = yaml.parse(t);
  if (!isConfig(c)) {
    throw new Error("コンフィグファイルの形式が不正");
  }
  __global_config = c;
  return c;
}

function sanitizeResourceName(n: string) {
  if (n.length == 0) {
    throw new Error(`無効なリソース名 ${n}`);
  }
  if (!/[a-zA-Z0-9-_.]/.test(n)) {
    throw new Error(`無効なリソース名 ${n}`);
  }
}

/**
 * returns stdout
 */
async function execCommand(c: Deno.Command): Promise<string> {
  const o = await c.output();

  const decoder = new TextDecoder();

  if (!o.success) {
    console.error(c);
    console.error(decoder.decode(o.stdout));
    console.error(decoder.decode(o.stderr));
    throw new Error("コマンド実行に失敗");
  }

  return decoder.decode(o.stdout);
}

// FIXME: returns any
async function getKubernetesNamespacedResources(
  fullKind: string,
  namespace: string
): Promise<any> {
  const apiVersion = fullKind.split(":")[0];
  const kind = fullKind.split(":")[1];

  sanitizeResourceName(apiVersion);
  sanitizeResourceName(kind);
  sanitizeResourceName(namespace);

  let resourceName = kind;
  const apiGroup = apiVersion.split("/")[0];
  if (apiGroup !== "v1") {
    resourceName += "." + apiGroup;
  }

  const cmd = new MyCommand("kubectl", {
    args: ["get", resourceName, `-n=${namespace}`, "-o=yaml"],
  });
  const out = await execCommand(cmd);

  return yaml.parse(out) as any;
}

// FIXME: returns any
async function getKubernetesClsuterScopedResources(
  fullKind: string
): Promise<any> {
  // ClusterScoped なリソースは -n=default で検索しても取得できるので、サボる
  const res = await getKubernetesNamespacedResources(fullKind, "default");
  return res;
}

async function getKubernetesNamespaces(): Promise<string[]> {
  const cmd = new MyCommand("kubectl", {
    args: ["get", "ns", "-o=yaml"],
  });
  const out = await execCommand(cmd);
  const nss: any = yaml.parse(out);

  return nss.items.map((v: any) => v.metadata.name);
}

async function getKubernetesClusterScopedAPIResources(): Promise<string[]> {
  const cmd = new MyCommand("kubectl", {
    args: ["api-resources", "--namespaced=false", "--no-headers"],
  });
  const out = await execCommand(cmd);

  const rs = [];
  for (const line of out.split("\n")) {
    const col = line.split(/\s+/);
    // 短縮名がない場合、左から name, apiVersion, namespaced, kind
    if (col.length === 4) {
      rs.push(col[1] + ":" + col[3]);
    }
    // 短縮名がある場合、左から name, shortnames, apiVersion, namespaced, kind
    if (col.length === 5) {
      rs.push(col[2] + ":" + col[4]);
    }
  }
  return rs;
}

async function deleteKubernetesNamespacedResource(
  fullKind: string,
  name: string,
  namespace: string
): Promise<void> {
  const apiVersion = fullKind.split(":")[0];
  const kind = fullKind.split(":")[1];

  sanitizeResourceName(apiVersion);
  sanitizeResourceName(kind);
  sanitizeResourceName(namespace);

  let resourceName = kind;
  const apiGroup = apiVersion.split("/")[0];
  if (apiGroup !== "v1") {
    resourceName += "." + apiGroup;
  }

  const cmd = new MyCommand("kubectl", {
    args: ["delete", resourceName, name, `-n=${namespace}`],
  });

  if (isApplyMode()) {
    console.error(cmd.toString());
    console.error(await execCommand(cmd));
    return;
  }

  console.error(cmd.toString());
}

async function applyKubernetesManifets(): Promise<void> {
  const cmd = new MyCommand("kubectl", {
    args: ["apply", `-f=${MANIFEST_DIR}`, "--recursive"],
  });

  if (isApplyMode()) {
    console.error(cmd.toString());
    console.error(await execCommand(cmd));
    return;
  }

  console.error(cmd.toString());
}

class MyCommand extends Deno.Command {
  constructor(private command: string, private options: Deno.CommandOptions) {
    super(command, options);
  }

  override toString(): string {
    if (this.options.args) {
      return `${this.command} ${this.options.args.join(" ")}`;
    }
    return this.command;
  }
}

try {
  main();
} catch (e) {
  throw e;
}
