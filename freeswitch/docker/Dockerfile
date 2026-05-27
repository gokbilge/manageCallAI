FROM debian:bullseye

ARG FREESWITCH_VERSION=v1.10.12
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    build-essential \
    cmake \
    automake \
    autoconf \
    libtool-bin \
    pkg-config \
    libssl-dev \
    zlib1g-dev \
    libdb-dev \
    unixodbc-dev \
    libncurses5-dev \
    libexpat1-dev \
    libgdbm-dev \
    bison \
    erlang-dev \
    libtpl-dev \
    libtiff5-dev \
    uuid-dev \
    libpcre3-dev \
    libedit-dev \
    libsqlite3-dev \
    libcurl4-openssl-dev \
    nasm \
    libogg-dev \
    libspeex-dev \
    libspeexdsp-dev \
    libldns-dev \
    python3-dev \
    libavformat-dev \
    libswscale-dev \
    libavresample-dev \
    liblua5.2-dev \
    lua-socket \
    lua-cjson \
    libopus-dev \
    libpq-dev \
    libsndfile1-dev \
    libflac-dev \
    libvorbis-dev \
    libshout3-dev \
    libmpg123-dev \
    libmp3lame-dev \
  && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 --branch ${FREESWITCH_VERSION} https://github.com/signalwire/freeswitch /usr/src/freeswitch \
  && git clone https://github.com/signalwire/libks /usr/src/libs/libks \
  && git clone --depth 1 https://github.com/freeswitch/sofia-sip /usr/src/libs/sofia-sip \
  && git clone --depth 1 https://github.com/freeswitch/spandsp /usr/src/libs/spandsp \
  && git clone --depth 1 https://github.com/signalwire/signalwire-c /usr/src/libs/signalwire-c

RUN cd /usr/src/libs/libks \
  && cmake . -DCMAKE_INSTALL_PREFIX=/usr -DWITH_LIBBACKTRACE=1 \
  && make -j"$(nproc)" \
  && make install

RUN cd /usr/src/libs/sofia-sip \
  && ./bootstrap.sh \
  && ./configure CFLAGS="-g -ggdb" --with-pic --with-glib=no --without-doxygen --disable-stun --prefix=/usr \
  && make -j"$(nproc)" \
  && make install

RUN cd /usr/src/libs/spandsp \
  && ./bootstrap.sh \
  && ./configure CFLAGS="-g -ggdb" --with-pic --prefix=/usr \
  && make -j"$(nproc)" \
  && make install

RUN cd /usr/src/libs/signalwire-c \
  && PKG_CONFIG_PATH=/usr/lib/pkgconfig cmake . -DCMAKE_INSTALL_PREFIX=/usr \
  && make -j"$(nproc)" \
  && make install

RUN sed -i 's|#formats/mod_shout|formats/mod_shout|' /usr/src/freeswitch/build/modules.conf.in
RUN sed -i 's|applications/mod_spandsp|#applications/mod_spandsp|' /usr/src/freeswitch/build/modules.conf.in
RUN sed -i 's|#xml_int/mod_xml_curl|xml_int/mod_xml_curl|' /usr/src/freeswitch/build/modules.conf.in

RUN cd /usr/src/freeswitch \
  && ./bootstrap.sh -j \
  && ./configure \
  && make -j"$(nproc)" \
  && make install \
  && sed -i 's|<!-- <load module="mod_xml_curl"/> -->|<load module="mod_xml_curl"/>|' /usr/local/freeswitch/conf/autoload_configs/modules.conf.xml \
  && sed -i 's|<load module="mod_spandsp"/>|<!-- <load module="mod_spandsp"/> -->|' /usr/local/freeswitch/conf/autoload_configs/modules.conf.xml

COPY conf/autoload_configs/xml_curl.conf.xml.example /usr/local/freeswitch/conf/autoload_configs/xml_curl.conf.xml.tmpl
COPY conf/autoload_configs/event_socket.conf.xml.example /usr/local/freeswitch/conf/autoload_configs/event_socket.conf.xml.tmpl
COPY conf/dialplan/managecall_entry.xml.example /usr/local/freeswitch/conf/dialplan/managecall_entry.xml
COPY conf/dialplan/inbound_did.xml.example /usr/local/freeswitch/conf/dialplan/inbound_did.xml
COPY lua/managecall_entry.lua /usr/local/freeswitch/scripts/managecall_entry.lua
COPY lua/inbound_route.lua /usr/local/freeswitch/scripts/inbound_route.lua
COPY docker/entrypoint.sh /usr/local/bin/managecallai-freeswitch-entrypoint

RUN chmod +x /usr/local/bin/managecallai-freeswitch-entrypoint

EXPOSE 8021/tcp
EXPOSE 5060/tcp 5060/udp 5080/tcp 5080/udp
EXPOSE 5061/tcp 5061/udp 5081/tcp 5081/udp
EXPOSE 7443/tcp
EXPOSE 5070/tcp 5070/udp
EXPOSE 16384-32768/udp
EXPOSE 64535-65535/udp

CMD ["/usr/local/bin/managecallai-freeswitch-entrypoint"]
