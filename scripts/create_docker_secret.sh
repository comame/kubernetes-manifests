# docker CLI に設定されている docker pull 用の認証情報を Kubernetes にコピーする

kubectl create secret generic regcred --from-file=.dockerconfigjson=/home/comame/.docker/config.json --type=kubernetes.io/dockerconfigjson -n=$1
