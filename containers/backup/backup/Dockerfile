FROM ubuntu:24.04

RUN apt-get update && apt-get install -y \
    ca-certificates \
    wget \
    curl \
    jq \
    zip \
    mysql-client \
    vim

COPY entrypoint.sh /entrypoint.sh
COPY . /work/


CMD ["/entrypoint.sh"]
