FROM signalwire/freeswitch:latest

COPY conf/autoload_configs/xml_curl.conf.xml.example /etc/freeswitch/autoload_configs/xml_curl.conf.xml
COPY conf/autoload_configs/event_socket.conf.xml.example /etc/freeswitch/autoload_configs/event_socket.conf.xml
COPY conf/dialplan/managecall_entry.xml.example /etc/freeswitch/dialplan/managecall_entry.xml
COPY lua/managecall_entry.lua /usr/share/freeswitch/scripts/managecall_entry.lua
