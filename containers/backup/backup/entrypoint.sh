#!/bin/bash

set -ex

mkdir -p ~/backup

eval `/work/setup-go.sh`

# MySQL

mkdir -p ~/backup/mysql
cd ~/backup/mysql

set +x # パスワードがうっかり表示されないように、出力をオフ
echo "mysqldump"
mysqldump -hmysql.comame.dev -uroot -p"${MYSQL_ROOT_PASSWORD}" --all-databases > mysql.sql
set -x

# Kubernetes secrets

cd /work
go run . secrets > ~/backup/kubernetes-secrets.yaml

# Docker registry
mkdir -p ~/backup/docker-registry
cd /mnt/registry
cp -r auth ~/backup/docker-registry/
cp -r docker ~/backup/docker-registry/
cp htpasswd ~/backup/docker-registry/

# finalize

cd /work
zip -0qr /work/backup.zip ~/backup
go run . upload
