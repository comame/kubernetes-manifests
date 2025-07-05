#!/bin/bash

set -ex

REGISTRY="registry.comame.dev"

if [ -z "$1" ]; then
    echo "build-container namespace/name"
    exit 1
fi

if [ ! -d "$1" ]; then
    echo "Directory $1 does not exist."
    exit 1
fi

cd $1
IMAGE=$(echo "$1" | sed s/"\/$"//)

docker build -t "$REGISTRY/$IMAGE" .
