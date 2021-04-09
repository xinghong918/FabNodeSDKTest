/*
 * Test Fabric v1.0 NodeJS SDK
 * Author: Cathy Xing
 *
 */
var log4js = require('log4js');
var path = require('path');
var hfc = require('fabric-client');
var logger = log4js.getLogger('Main');
//logger.setLevel('DEBUG');
logger.level = 'DEBUG';

var enrollAdmin = require('./app/enrollAdmin');
var registerUser = require('./app/registerUser');
var query = require('./app/query.js');
var invoke = require('./app/invoke.js');
var installCC = require('./app/install-chaincode.js');
var instantiateCC = require('./app/instantiate-chaincode.js');
var upgradeCC = require('./app/upgrade-chaincode.js');
var channels = require('./app/create-channel.js');
var join = require('./app/join-channel.js');
var ccEvent = require('./app/chaincode-event.js');
var blockEvent = require('./app/block-event.js');
const { resolve } = require('path');
/**
 * node testAPIs.js [ enrollAdminUser |  registerUser | installCC | activateCC | upgradeCC | query | invoke 
 *                  | createChannel | queryChannel | joinChannel | ccEvent | blockEvent ]
 */
var _main = function () {
    logger.info('========== Start testing ============');
    let myArgs = process.argv.slice(2);
    if (myArgs.length != 1) {
        logger.info('========== Wrong argument, please try: node testAPIs.js enrollAdminUser ============');
        return;
    }
    var testType = myArgs[0];
    loadConfigFile();

    let endorsementPolicy = {};
    var adminCerts = {
        "key": "OBPFounder/admincert/OBPFounder-key",
        "cert": "OBPFounder/admincert/OBPFounder-cert.pem"
    };

    // P2 is Fabric Participant, not OBP participant
    var P2adminCerts = {
        "key": "minifab/admincert/minifab-adminkey",
        "cert": "minifab/admincert/minifab-admincert.pem"
    };  
    var peerPemFile = '/OBPFounder-instance-info/artifacts/crypto/peerOrganizations/OBPFounder/tlscacert/OBPFounder-tlscacerts.pem',
        orderPemFile = '/OBPFounder-instance-info/artifacts/crypto/ordererOrganizations/OBPFounder/tlscacert/OBPFounder-tlscacerts.pem';

    var P2adminPemFile = '/minifab-asia/keyfiles/peerOrganizations/xh.cloudns.asia/msp/admincerts/Admin@org1.example.com-cert.pem';
    var P2caPemFile = '/minifab-asia/keyfiles/peerOrganizations/xh.cloudns.asia/msp/cacerts/ca0.org1.example.com-cert.pem';
    var P2tlsPemFile = '/minifab/keyfiles/peerOrganizations/org1.example.com//msp/tlscacerts/tlsca0.org1.example.com-cert.pem';

    var caURL = 'https://obpfounder-xxx.oraclecloud.com:7443';       // Founder ca
    var peer0URL = 'grpcs://obpfounder-xxx.oraclecloud.com:20009',   // Founder peer0
        peer1URL = 'grpcs://obpfounder-xxx.oraclecloud.com:20010',   // Founder peer1
        orderURL = 'grpcs://obpfounder-xxx.oraclecloud.com:20003',   // Founder orderer

        P2peer0URL = 'grpcs://peer0.org1.example.com:7789',  // Participant 2(Fabric) peer0
        P2peer1URL = 'grpcs://peer1.org1.example.com:7790'
        P2peer2URL = 'grpcs://peer2.org1.example.com:7791'
        P2caURL = 'https://ca0.org1.example.com:7788';   // Participant 2 ca

    new Promise((resolve, reject) => {
        switch (testType) {
            // Generate the JSON file for adding New Org to OBP
            case 'genOrgJSON':
                obptools.genNewOrgJSONFile('org1-example-com', P2adminPemFile, P2caPemFile, P2tlsPemFile);
                break;
            //  Enroll user: Admin
            case 'enrollAdminUser':
                // function(userName, mspid, ca_url, tlsPemFile) 
               enrollAdmin.getAdminUser('hlfAdmin', 'org1-example-com', P2caURL).then(resolve, reject);
                
                break;
            // Register User
            case 'registerUser':
                enrollAdmin.getAdminUser('hlfAdmin', 'Org1MSP', P2caURL).then(() => {
                    // function(userName, mspid, ca_url) 
                    registerUser.getRegisteredUser('cathy', 'Org1MSP', P2caURL);
                }).then(resolve, reject);
                break;
            // Query Chaincode
            case 'query':
                // Participant
                enrollAdmin.getAdminUser('hlfAdmin', 'org1-example-com', P2caURL).then(() => {
                    // function(channelName, peerURL, chaincodeName, fcn, args, adminUser, peerTlsPemFile)
                    query.queryChaincode('mychannel', P2peer0URL, 
                        'mycc', 'query', ['b'], 'hlfAdmin', P2tlsPemFile).then(resolve, reject);
                });
                break;
            // inovke transaction
            case 'invoke':
                // function (channelName, peerURLs, orderURL, chaincodeName, fcn, args, adminUser, 
                //    peerTlsPemFile, orderTlsPemFile)
                invoke.invokeChaincode('mychannel', [P2peer0URL, peer0URL], orderURL,
                    'mycc', 'move', ["b", "a", "10"], 'hlfAdmin', 
                    [P2tlsPemFile, peerPemFile], orderPemFile).then(resolve, reject);
                break;
            // Install Chaincode
            case 'installCC':
                // function(peerURLs, chaincodePath, chaincodeName, chaincodeVersion, adminUser, mspID, adminCerts, peerTlsPemFile)
                // install on participant
                installCC.installChaincode([P2peer0URL],
                    'github.com/example_cc', 'mycc', 'v1', 'hlfAdmin', 'org1-example-com', P2adminCerts, P2tlsPemFile).then(resolve, reject);
                break;
            // Instantiate Chaincode
            case 'activateCC':
                endorsementPolicy = {
                    identities: [{
                            role: {
                                name: "member",
                                mspId: "OBPFounder"
                            }
                        },
                        {
                            role: {
                                name: "member",
                                mspId: "org1-example-com"
                            }
                        }
                    ],
                    policy: {
                        "1-of": [{
                            "signed-by": 0
                        }, {
                            "signed-by": 1
                        }]
                    }
                };
                /*
                 *  function(channelName, peerURLs, orderURL, chaincodeName, chaincodeVersion, functionName, 
                 *           args, endorsementPolicy, adminUser, mspID, adminCerts, peerTlsPemFile, orderTlsPemFile)
                 */
                // from participant
                instantiateCC.instantiateChaincode('mychannel', 
                    [P2peer0URL], orderURL, 
                    'mycc', 'v1', null, ["a", "600", "b", "300"], endorsementPolicy, 'hlfAdmin', 'org1-example-com', P2adminCerts,
                    P2tlsPemFile, orderPemFile).then(resolve, reject);
                break;
                // Upgrade Chaincode
            case 'upgradeCC':
                endorsementPolicy = {
                    identities: [{
                            role: {
                                name: "member",
                                mspId: "OBPFounder"
                            }
                        },
                        {
                            role: {
                                name: "member",
                                mspId: "org1-example-com"
                            }
                        }
                    ],
                    policy: {
                        "1-of": [{
                            "signed-by": 0
                        }, {
                            "signed-by": 1
                        }]
                    }
                };
                /*
                 * function(channelName, [peer0URL, peer1URL], orderURL, chaincodeName, chaincodeVersion, functionName, 
                 *           args, endorsementPolicy, adminUser, mspID, adminCerts, peerTlsPemFile, orderTlsPemFile)
                 */
                upgradeCC.upgradeChaincode('mychannel', [P2peer0URL], orderURL, 'mycc', 'v2', 
                    null, null, endorsementPolicy, 'hlfAdmin', 'org1-example-com', P2adminCerts,
                    P2tlsPemFile, orderPemFile).then(resolve, reject);

                break;
                // Create Channels
            case 'createChannel':
                let txPath = '../artifacts/channel/channel.tx',
                    mspID = 'bcdcdev';
                let policy = {
                    "Readers": {
                        "mspids": ["bcdcdev", "bcdcdevorg2"]
                    },
                    "Writers": {
                        "mspids": ["bcdcdev", "bcdcdevorg2"]
                    }
                };
                let channelName = 'cathy';
                // First need: ./configtxlator start
                channels.updateCreateChannelBlockACL(txPath, policy, mspID).then((new_block) => {
                    // function(channelName, peerURL, orderURL, channelConfigPath, adminUser, mspID, adminCerts, peerTlsPemFile, orderTlsPemFile)
                    return channels.createChannel(channelName, peer0URL, orderURL, txPath,
                        'admin', mspID, adminCerts, peerPemFile, orderPemFile);
                }).then(() => {
                    setTimeout(function () {
                        return join.joinChannel(channelName, 
                            [peer0URL], 
                            orderURL,
                            'admin', mspID, adminCerts, peerPemFile, orderPemFile);
                    }, 3000);
                }, (err) => {
                    logger.error("Create Channel Fail!");
                }).then(resolve, reject);
                break;
            // query Channel
            case 'queryChannel':
                // function(channelName, peerURL, adminUser, peerTlsPemFile)
                query.getChainInfo('mychannel', P2peer0URL, 'hlfAdmin', P2tlsPemFile).then(resolve, reject);
                break;
            // join Channel, must use Founder's orderer url, can't use participant's orderer
            case 'joinChannel':
                // function(channelName, peerURLs, orderURL, adminUser, mspID, adminCerts, peerTlsPemFile, orderTlsPemFile)
                join.joinChannel('mychannel', 
                [P2peer0URL], orderURL,
                'hlfAdmin', 'org1-example-com', P2adminCerts, P2tlsPemFile, orderPemFile).then(resolve, reject);
                // break;
            // Chaincode Event
            // case 'ccEvent':
            //     // function (eventURL, chaincodeName, eventName, adminUser, peerTlsPemFile)
            //     ccEvent.chaincodeEvent(peer0EventURL,'mycc1', 'testEvent', 'admin', peerPemFile).then(resolve, reject);
            //     break;
            // Block Event
            // case 'blockEvent':
            //     // function (eventURL, adminUser, peerTlsPemFile)
            //     blockEvent.blockEvent(peer0EventURL, 'admin', peerPemFile).then(resolve, reject);
            //     break;
            default:
                resolve();
        }
    }).then(() => {
        logger.info('========== End testing ============');
    }).catch((err) => {
        logger.error(err);
        logger.info('========== End testing with error ============');
    });

};

var loadConfigFile = function () {
    hfc.addConfigFile(path.join(__dirname, 'config.json'));
    logger.info('Done loading config file.');
};


(function main() {
    _main();
})();