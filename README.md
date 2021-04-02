# FabNodeSDKTest
Hyperledger Fabric SDK v1.4.7 for node.js Samples

## Get Started:
### sh npm_bcs_client.sh

## Examples e.g.:
   - Enroll Admin User: ```node testAPIs.js enrollAdminUser```
   - Query Chaincode: ```node testAPIs.js query```
   - Invoke Chaincode: ```node testAPIs.js invoke```


## Function List
  - Enroll Admin User
  - Register User
     - With ABAC(Attribute-Based Access Control)
  - Create Channel
  - Join Peers to Channel
  - Query Channel
  - Install Chaincode on Peers
  - Instantiate Chaincode on Channel
     - Endorsement Policy
  -	Upgrade Chaincode
     - Endorsement Policy
  -	Invoke Transaction 
  -	Query Chaincode
  - ~~Chaincode Event~~
  - ~~Block Event~~


## Collaterals: 
### [**Minifab**](https://github.com/hyperledger-labs/minifabric)
#### Install Minifab:
   1. ```mkdir -p ~/mywork && cd ~/mywork && curl -o minifab -sL https://tinyurl.com/yxa2q6yr && chmod +x minifab```
   2. ```sudo mv minifab /usr/local/bin/```
   3. ```minifab -h```
   4. New spec.yaml
      ```
      fabric:
         cas:
         - "ca0.org1.example.com"
         peers: 
         - "peer0.org1.example.com"
         - "peer1.org1.example.com"
         settings:
            ca:
               FABRIC_LOGGING_SPEC: DEBUG
            peer:
               FABRIC_LOGGING_SPEC: INFO
            orderer:
               FABRIC_LOGGING_SPEC: DEBUG
         netname: "mynet"
      ```
   5. **Start Minifab:**
      ```
      cd ~/mywork
      minifab netup -e 7788 -i 1.4.7 -o org1.example.com
      ```