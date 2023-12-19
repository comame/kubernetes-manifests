#! /bin/bash

cd $(dirname $0)

mkdir -p ./secrets

cat secrets.txt | while read line; do
    ns=$(echo $line | awk '{print $1}')
    name=$(echo $line | awk '{print $2}')

    out=$(kubectl get secret $name -n=$ns -o=yaml)
    echo -e "$out" > "secrets/${ns}__${name}.yml"
done
