resource "helm_release" "calico" {
  name       = "calico"
  repository = "https://docs.tigera.io/calico/charts"
  chart      = "tigera-operator"
  version    = "3.28.0"

  namespace        = "tigera-operator"
  create_namespace = true
}
