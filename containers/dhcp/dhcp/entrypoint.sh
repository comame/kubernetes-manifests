#!/bin/bash
dhcpd -user dhcp -group dhcp -f -4 -cf /home/dhcp/conf/dhcpd.conf -lf /home/dhcp/leases/dhcpd.leases
