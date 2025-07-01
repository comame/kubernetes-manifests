# アップグレード時は Controller のバージョンも上げること
resource "helm_release" "ingress-nginx" {
  name       = "ingress-nginx"
  repository = "https://kubernetes.github.io/ingress-nginx"
  chart      = "ingress-nginx"
  version    = "4.12.3"

  namespace        = "ingress-nginx"
  create_namespace = true
}
