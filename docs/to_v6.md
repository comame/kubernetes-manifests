# なぜやりたいのか

- 自宅サーバーを IPv6 アドレスでも直接接続できるようにしたい
- 実用性がどのくらいあるかは全くもって不明だが、とにかくかっこいいから

# 構成の案

podネットワークは ULA で設定し、一部の外部から接続される Service (Ingress くらいしかないはず) にだけ GUA を LoadBalancer から割り当てたい。
なぜなら、GUA は ISP から割り当てられており、(基本的に変わりにくいとはいえ) 変更され得るため。クラスタ内部のアドレスに GUA を設定してしまえば色々楽かもしれないが、ISP から割り当てられたプレフィックスが変更されるたびにクラスタのあちこちの設定を変えて回るのは許容し難い。LoadBalancer の範囲などを変えるのはまあしょうがないとする (できれば自動化したいし、実際できるだろう)。

podSubnet は今までの 10.244.0.0/16 に加え fd00:8:244::/64 を、serviceSubnet は今までの 10.96.0.0/12 に加え fd00:8:96::/112 を設定することにする。8はk8sの8 (そんな決め方でいいのか？)。

# 作業ログ

前提: クラスタを作成し直すのは嫌なので、稼働させたままなんとかしたい

## クラスタをデュアルスタック構成にする

https://kubernetes.io/docs/concepts/services-networking/dual-stack/#configure-ipv4-ipv6-dual-stack

- kube-apiserver などのフラグを書き換える
  - kubeadm のコンフィグを書き直して `kubeadm init phase upload-config` を叩く
    - `ClusterConfiguration` の `networking.podSubet` と `networking.serviceSubnet` に IPv6 アドレスを付け加える
    - kube-system 名前空間の cm/kube(let|adm)-config が変更されていることを確認する
	- 直接 Static Pod のマニフェストを書き換えると `kubeadm upgrade` した時に戻ってしまうので、これをしないといけない
  - `kubeadm init phase control-plane all` をして、Static Pod のマニフェストを再生成
    - 流石にやらかしが怖いので /etc/kubernetes/manifests はバックアップしておく
  - ちゃんと kube-apiserver が立ち上がってきたのでとりあえず一安心する
    - calico の設定をしていないので、まだ当然 Pod に IPv6 アドレスは割り当てられない
- kubelet のフラグを書き換える
  - ベアメタルのクラスタでは kubelet の node-ip フラグを指定する必要があるらしいので、/var/lib/kubelet-flags.env を書き換えて、systemctl restart kubelet する
    - これはマシンに実際に割り当たっている IP アドレスを設定
  - kubectl describe nodes して割り当たっていれば OK
    - InternalIP には割り当てられているが、PodCIDR には IPv6 アドレスが割り当たっていないことに気がついた
	- Gemini 先生によると `kubectl delete node <name>` せよとのことなので、やる

## Calico を IPv6 でも使えるようにする

- クラスタ自体はデュアルスタック構成になったが、まだ Pod 間で IPv6 で通信はできない
- PodCIDR に設定したのと同じ範囲を指定した IPPool を作成する
  - PodCIDR は ULA なのでそのままでは Pod からインターネットに出られない。`natOutgoing: true` にしておく

## 一旦ここで動作確認

- 適当に Pod を立てて、これらを確認する
  - 他の Pod の IPv6 アドレスに対して curl して返ってくる
  - `ipFamilyPolicy: PreferDualStack` を設定した Service の IPv6 アドレスに対して curl して返ってくる
  - `curl -6 https://www.google.com` して返ってくる

## MetalLB の IPAddressPool に GUA を追加する

- IPAddressPool に ISP から割り当てられた GUA を設定する
  - `type: Loadbalancer` の Service を `ipFamilyPolicy: PreferDualStack` にすると、IPv6 アドレスが割り当てられる
    - LoadbalancerIP に IPv4 アドレスを指定したままだと、正しく IPv6 アドレスが割り当てられない。この場合は[アノテーションを利用して複数の IP アドレスを要求する](https://metallb.universe.tf/usage/#ipv6-and-dual-stack-services)か、IPv4 と IPv6 で独立した Service に分割すると良さそう
  - 自宅内からは接続できるようになったが、インターネットから接続できない
    - HGW 側のファイアウォールが悪さをしていた、見落としがち
