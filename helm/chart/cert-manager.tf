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
