#! /bin/bash

# バックアップ用に Secret を取得する

DATE=$(date +%Y%m%d-%H%M%S)
FILENAME="secrets-$DATE.yaml"

kubectl get secret --all-namespaces -o=yaml > "secrets/$FILENAME"
deno -A scripts/internal/commit_scripts.deno.ts "$FILENAME"

git add "secrets-commit/$FILENAME"
