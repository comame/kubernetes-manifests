# アップグレード時は Controller のバージョンも上げること
resource "helm_release" "ingress-nginx" {
  name       = "ingress-nginx"
  repository = "https://kubernetes.github.io/ingress-nginx"
  chart      = "ingress-nginx"
  version    = "4.11.5"

  namespace        = "ingress-nginx"
  create_namespace = true
}
