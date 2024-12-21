# FIXME: terraform apply に成功しないので、手動デプロイ。いずれ ArgoCD に移行する
# helm install cert-manager cert-manager --repo https://charts.jetstack.io --version v1.13.3 --namespace cert-manager --create-namespace --set crds.enabled=true

resource "helm_release" "cert-manager" {
  name       = "cert-manager"
  repository = "https://charts.jetstack.io"
  chart      = "cert-manager"
  version    = "1.16.2"

  create_namespace = true
  namespace        = "cert-manager"

  set {
    name  = "crds.enabled"
    value = true
  }
}
