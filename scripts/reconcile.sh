# /bin/bash

# マニフェストの状態とクラスタの状態を一致させる
# 方針:
# - サーバにだけあってローカルにマニフェストが存在しないリソースは消す
# - それ以外は kubectl apply すれば反映されるので apply する

deno -A scripts/internal/reconcile.deno.ts "$@"
