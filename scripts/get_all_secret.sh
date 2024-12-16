#! /bin/bash

DATE=$(date +%Y%m%d-%H%M%S)
FILENAME="secrets-$DATE.yaml"

kubectl get secret --all-namespaces -o=yaml > "secrets/$FILENAME"
deno -A scripts/commit_scripts.deno.ts "$FILENAME"

git add "secrets-commit/$FILENAME"
