kubectl create secret generic regcred --from-file=.dockerconfigjson=/home/comame/.docker/config.json --type=kubernetes.io/dockerconfigjson -n=$1
