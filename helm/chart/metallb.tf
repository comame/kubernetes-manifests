resource "helm_release" "metallb" {
  name       = "metallb"
  repository = "https://metallb.github.io/metallb"
  chart      = "metallb"
  version = "0.15.2"

  namespace        = "metallb-system"
  create_namespace = true

  # https://metallb.io/troubleshooting/#metallb-is-not-advertising-my-service-from-my-control-plane-nodes-or-from-my-single-node-cluster
  # コントロールプレーンノードのラベルにより広告されない問題が起きないようにした
  set {
    name  = "speaker.ignoreExcludeLB"
    value = true
  }
}
