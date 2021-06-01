# Mock shim for chaincode offline test
cd $GOPATH/src
mkdir github.com
cd github.com
mkdir hyperledger
cd hyperledger

git clone https://github.com/hyperledger/fabric.git -b release-1.4 --single-branch fabric

国内设置阿里代理：
go env -w GO111MODULE=auto
go env -w GOPROXY=https://mirrors.aliyun.com/goproxy/,direct

下载shim pkg：
    新版的go(1.16.3)：
    GO111MODULE=on go get -u --tags nopkcs11 github.com/hyperledger/fabric/core/chaincode/shim
    
    老版go(1.14.6以前)：
    go get -u --tags nopkcs11 github.com/hyperledger/fabric/core/chaincode/shim

测试：
    go build --tags nopkcs11
    go test -v --tags nopkcs11
然后如果是新版的go(1.16.3)，因为改成使用module的模式，则运行test时需要加上GO111MODULE设成auto或者off，推荐用auto：
    GO111MODULE=auto go test -v --tags nopkcs11
    否则会报错：go: go.mod file not found in current directory or any parent directory; see 'go help modules'

    (推荐)也可一劳逸的方法：
    go env -w GO111MODULE=auto
    之后就可以直接使用 go test了



## Prerequisite to testing offline

* Ensure that Git and Go are already installed.
* Create the following directory structure and clone the hyperledger repository - specifying the release 1.4 branch:

```bash
# Navigate to the go src directory (Usually C:\Users\<username>\go\src on Windows, ~/go/src on \*nix)
$ cd ~/go/src
$ mkdir -p github.com/hyperledger
$ cd github.com/hyperledger
$ git clone https://github.com/hyperledger/fabric.git -b release-1.4 --single-branch fabric
$ go get -u --tags nopkcs11 github.com/hyperledger/fabric/core/chaincode/shim
```
Private Data将requiredPeerCount设为1时会报错：
SCCs-MacBook-Pro:FabNodeSDKTest scc$ node testAPIs_obpfounder.js invoke
[2021-05-11T15:21:44.451] [INFO] Main - ========== Start testing ============
[2021-05-11T15:21:44.457] [INFO] Main - Done loading config file.
[2021-05-11T15:21:44.464] [INFO] Invoke - Store path:./hfc-key-store
[2021-05-11T15:21:44.708] [INFO] Invoke - Successfully loaded founderAdmin from persistence
[2021-05-11T15:21:44.711] [INFO] Invoke - Assigning transaction_id:  c3130f1aa42685d2aa2757d4ed10661348c144cfbb29e0741eea364bb79f0b45
[2021-05-11T15:21:45.227] [DEBUG] Invoke - Proposal Responses: Error: failed to distribute private collection, txID c3130f1aa42685d2aa2757d4ed10661348c144cfbb29e0741eea364bb79f0b45, channel %sxh: could not build private data dissemination plan for chaincode myChaincode and collection privateDataCollection: required to disseminate to at least 1 peers, but know of only 0 eligible peers,Error: failed to distribute private collection, txID c3130f1aa42685d2aa2757d4ed10661348c144cfbb29e0741eea364bb79f0b45, channel %sxh: could not build private data dissemination plan for chaincode myChaincode and collection privateDataCollection: required to disseminate to at least 1 peers, but know of only 0 eligible peers
[2021-05-11T15:21:45.227] [INFO] Invoke - Transaction proposal was bad
[2021-05-11T15:21:45.227] [ERROR] Invoke - Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...
[2021-05-11T15:21:45.227] [ERROR] Invoke - Failed to invoke successfully :: Error: Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...
[2021-05-11T15:21:45.228] [ERROR] Main - Failed to invoke successfully :: Error: Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...




This error indicates that the endorsing peer is not able to communicate the private data to enough (in your case 1 other) peer. This generally is symptomatic of gossip endpoints not being configured correctly.

You can use the service discovery CLI(https://hyperledger-fabric.readthedocs.io/en/release-1.4/discovery-cli.html) to query your peer to find the other peers in the network that it is aware of. If the peer list is shorter than you expect it to be, then gossip is not configured correctly. Ensure that the anchor peer addresses and ports correctly resolve and correspond to the desired peer, ensure that the peer's TLS certificates validly chain to the TLS CAs defined in the channel config, and ensure that the external endpoint on the peers is set to true. Once you have resolved any underlying gossip networking configuration problems, your PDC distribution should begin to work.

