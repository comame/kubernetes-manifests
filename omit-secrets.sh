#! /bin/bash

cd $(dirname $0)

mkdir -p ./secrets-commit
FILES=$(ls secrets)

for FILE in $FILES; do
    cat secrets/$FILE | ./kube-omit-secret > ./secrets-commit/$FILE
done
