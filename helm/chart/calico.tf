# アップグレード時はドキュメント参照のこと。CRD を更新する必要がある
# https://docs.tigera.io/calico/latest/operations/upgrading/kubernetes-upgrade
resource "helm_release" "calico" {
  name       = "calico"
  repository = "https://docs.tigera.io/calico/charts"
  chart      = "tigera-operator"
  version    = "3.29.1"

  namespace        = "tigera-operator"
  create_namespace = true
}
