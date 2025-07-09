#!/bin/bash

versions=$(curl -sL 'https://golang.org/dl/?mode=json')
remote_version=$(echo "$versions" | jq -r '.[0].version')

tarball="/tmp/$remote_version.linux-amd64.tar.gz"
curl -sL https://go.dev/dl/$remote_version.linux-amd64.tar.gz -o $tarball
if [ $(stat -c %s $tarball) -lt 10000000 ]; then
    # 10MB未満ならダウンロード失敗とみなす
    exit 1
fi

mkdir -p ~/.local
tar -C ~/.local -xzf "/tmp/$remote_version.linux-amd64.tar.gz"
echo "export PATH=\$PATH:\$HOME/.local/go/bin"
