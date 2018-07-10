#!/bin/sh
WORK_DIR="${PWD}"
NPM_GLOBAL=0
NPM_PACKAGE=fabric-client
NPM_ROOT_DIR=""

usage()
{
  echo "Usage: $0 [-g] [fabric-client|hfc]" >&2
  echo """
Commands:
      -g                Install a global package
      fabric-client     fabric-client node sdk
      hfc               a fabric node sdk, including the fabric-client and fabric-ca-client
       """
  exit 1
}

check_arg()
{
  if [ "$1" = "-g" ]; then
    NPM_GLOBAL=1
    NPM_ROOT_DIR=$(npm root -g)
  elif [ "$1" = "fabric-client" ]; then
    NPM_PACKAGE=fabric-client
  elif [ "$1" = "hfc" ]; then
    NPM_PACKAGE=hfc
  else
    usage
  fi
}

edit_fabric_client()
{
  declare -r file="${BASE_DIR}""/deps/grpc/src/core/lib/security/security_connector/security_connector.cc"
  sed -i".orig" "s/if (p == nullptr) {/if (false) {/; s/if (\!grpc_chttp2_is_alpn_version_supported(p->value.data, p->value.length)) {/if (p \!= nullptr \&\& \!grpc_chttp2_is_alpn_version_supported(p->value.data, p->value.length)) {/" "${file}"
}

edit_hfc()
{
  declare -r file="${BASE_DIR}""/src/core/lib/security/transport/security_connector.c"
  sed -i".orig" "s/if (p == NULL) {/if (false) {/; s/if (\!grpc_chttp2_is_alpn_version_supported(p->value.data, p->value.length)) {/if (p \!= NULL \&\& \!grpc_chttp2_is_alpn_version_supported(p->value.data, p->value.length)) {/" "${file}"
}

edit_code() {
  if [ "$NPM_PACKAGE" = "fabric-client" ]; then
    edit_fabric_client
  else
    edit_hfc
  fi
}

rebuild_code() {
  if [ "$NPM_GLOBAL" -eq 1 ]; then
    cd "${NPM_ROOT_DIR}""/""${NPM_PACKAGE}"
  fi

  npm rebuild --unsafe-perm --build-from-source
}

main() {
  declare -r npm_global_option=$1
  declare -r package_name=$2

  if [ "$#" -gt 2 ]; then
    usage
  fi

  if [ "$#" -eq 1 ]; then
    check_arg "${npm_global_option}"
  fi
  if [ "$#" -eq 2 ]; then
    check_arg "${npm_global_option}"
    check_arg "${package_name}"
  fi


  if [ "$NPM_GLOBAL" -eq 1 ]; then
    BASE_DIR="${NPM_ROOT_DIR}""/$NPM_PACKAGE/node_modules/grpc"
    declare -r npm_option="--global --ignore-scripts"
  else
    BASE_DIR="./node_modules/grpc"
    declare -r npm_option="--ignore-scripts"
  fi

  npm install "${npm_option}" $NPM_PACKAGE 
  edit_code
  rebuild_code

  cd "${WORK_DIR}"
  npm install
}

main "$@"


