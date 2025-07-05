from ubuntu:24.04
run apt-get update && \
    apt-get install -y --no-install-recommends \
    isc-dhcp-server

copy entrypoint.sh /entrypoint.sh

run useradd dhcp -m
run mkdir -p /home/dhcp/leases && touch /home/dhcp/leases/dhcpd.leases

entrypoint ["/entrypoint.sh"]
