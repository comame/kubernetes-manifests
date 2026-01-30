FROM ubuntu:24.04

RUN useradd -m terraria
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates wget unzip

USER terraria
WORKDIR /home/terraria
RUN wget https://terraria.org/api/download/pc-dedicated-server/terraria-server-1451.zip && \
    unzip terraria-server-1451.zip && \
    chmod +x 1451/Linux/TerrariaServer.bin.x86_64

COPY entrypoint.sh /home/terraria/entrypoint.sh

ENTRYPOINT [ "/home/terraria/entrypoint.sh" ]
