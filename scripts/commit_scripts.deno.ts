import { parse, stringify } from "jsr:@std/yaml";

const { args, readTextFile, writeTextFile } = Deno;

const [filename] = args;
const secretFile = await readTextFile(`secrets/${filename}`);
const secrets = parse(secretFile);

if (!assertSecretList(secrets)) {
  throw RangeError("フォーマットがおかしい");
}

secrets.items = secrets.items.filter((s) => {
  const excludeNamespaces = [
    "tigera-operator",
    "calico-apiserver",
    "calico-system",
    "kube-system",
    "cert-manager",
    "ingress-nginx",
    "metallb-system",
  ];
  if (excludeNamespaces.includes(s.metadata.namespace ?? "")) {
    return false;
  }

  // cert-manager によって作られた TLS 証明書を落とす (容易に再生成できるので)
  if (s.metadata.labels) {
    if (s.metadata.labels["controller.cert-manager.io/fao"] === "true") {
      return false;
    }
  }

  return true;
});

secrets.items.forEach((s, i) => {
  // $.data を落とす
  for (const k of Object.keys(s.data)) {
    secrets.items[i].data[k] = "REDACTED";
  }

  // $.metadata.annotations['kubectl.kubernetes.io/last-applied-configuration'] を落とす
  if (s.metadata.annotations) {
    delete s.metadata.annotations[
      "kubectl.kubernetes.io/last-applied-configuration"
    ];
  }
});

const redactedSecretFile = stringify(secrets);
await writeTextFile(`secrets-commit/${filename}`, redactedSecretFile);

interface secretListV1 {
  kind: "List";
  apiVersion: "v1";
  items: secretV1[];
}

interface secretV1 {
  kind: "Secret";
  apiVersion: "v1";
  data: Record<string, string>;
  metadata: metadata;
}

interface metadata {
  namespace?: string;
  annotations?: Record<string, string>;
  labels?: Record<string, string>;
}

function assertSecretList(arg: any): arg is secretListV1 {
  try {
    if (arg["kind"] !== "List") {
      return false;
    }
    if (arg["apiVersion"] !== "v1") {
      return false;
    }
    for (const s of arg["items"]) {
      if (s["kind"] !== "Secret") {
        return false;
      }
      if (s["apiVersion"] !== "v1") {
        return false;
      }
    }

    return true;
  } catch (_) {
    return false;
  }
}
