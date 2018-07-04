/*
 * Test Fabric v1.0 NodeJS SDK
 * Author: Cathy Xing
 * 
 */
var log4js = require('log4js');
var path = require('path');
var hfc = require('fabric-client');
var logger = log4js.getLogger('Main');
logger.setLevel('DEBUG');

var enrollAdmin = require('./app/enrollAdmin');
var registerUser = require('./app/registerUser');
var query = require('./app/query.js');
var invoke = require('./app/invoke.js');
var installCC = require('./app/install-chaincode.js');
var instantiateCC = require('./app/instantiate-chaincode.js');
var upgradeCC = require('./app/upgrade-chaincode.js');

/**
 * node testAPIs.js [ enrollAdminUser |  registerUser | installCC | activateCC | upgradeCC | query | invoke  ]
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
    let adminCerts = {};

    new Promise((resolve, reject) => {
        switch (testType) {
            //  Enroll user: Admin
            case 'enrollAdminUser':
                // function(userName, mspid, ca_url) 
                enrollAdmin.getAdminUser('admin', 'DetroitAuto', 'http://localhost:32768').then(resolve, reject);
                break;
            // Register User
            case 'registerUser':
                enrollAdmin.getAdminUser('admin', 'DetroitAuto', 'http://localhost:32768').then(() => {
                    // function(userName, mspid, ca_url) 
                    registerUser.getRegisteredUser('cathy', 'DetroitAuto', 'http://localhost:32768');
                }).then(resolve, reject);
                break;
            // Query Chaincode
            case 'query':
                enrollAdmin.getAdminUser('admin', 'DetroitAuto', 'http://localhost:32768').then(() => {
                    // function(channelName, peerURL, chaincodeName, fcn, args, adminUser)
                    query.queryChaincode('samchannel', 'grpc://localhost:10000', 'mycc', 'query', ['a'], 'admin').then(resolve, reject);
                });
                break;
            // inovke transaction
            case 'invoke':
                // function (channelName, peerURLs, orderURL, eventURL, chaincodeName, fcn, args, adminUser)
                invoke.invokeChaincode('samchannel', ['grpc://localhost:10000', 'grpc://localhost:10006'], 
                    'grpc://localhost:7000', 'grpc://localhost:10002',
                    'mycc', 'move', ["b", "a", "10"], 'admin').then(resolve, reject);
                break;
            // Install Chaincode
            case 'installCC':
                adminCerts = {
                    "key": "dauto.com/users/Admin@dauto.com/msp/DetroitAuto_key",
                    "cert": "dauto.com/users/Admin@dauto.com/msp/DetroitAuto_cert.pem"
                };
                // function(channelName, peerURLs, orderURL, chaincodePath, chaincodeName, chaincodeVersion, adminUser, mspID, adminCerts)
                installCC.installChaincode('samchannel', ['grpc://localhost:10000', 'grpc://localhost:10003'], 
                    'grpc://localhost:7000', 'github.com/example_cc',
                    'mycc', 'v0', 'admin', 'DetroitAuto', adminCerts).then(resolve, reject);
                break;
            // Instantiate Chaincode
            case 'activateCC':
                endorsementPolicy = {
                    identities: [
                        {
                            role: { name: "member", mspId: "DetroitAuto" }
                        },
                        {
                            role: { name: "member", mspId: "SamDealer" }
                        }],
                    policy: {
                        "2-of": [{ "signed-by": 0 }, { "signed-by": 1 }]
                    }
                };
                adminCerts = {
                    "key": "dauto.com/users/Admin@dauto.com/msp/DetroitAuto_key",
                    "cert": "dauto.com/users/Admin@dauto.com/msp/DetroitAuto_cert.pem"
                };
                /*
                *  function(channelName, peerURLs, orderURL, chaincodeName, chaincodeVersion, functionName, 
                *           args, endorsementPolicy, adminUser, mspID, adminCerts)
                */
                instantiateCC.instantiateChaincode('samchannel', ['grpc://localhost:10000'], 
                    'grpc://localhost:7000', 'mycc', 'v0', null,
                    ["a", "100", "b", "200"], endorsementPolicy, 'admin', 'DetroitAuto', adminCerts).then(resolve, reject);
                break;
            // Upgrade Chaincode
            case 'upgradeCC':
                endorsementPolicy = {
                    identities: [
                        {
                            role: { name: "member", mspId: "DetroitAuto" }
                        },
                        {
                            role: { name: "member", mspId: "SamDealer" }
                        }],
                    policy: {
                        "1-of": [{ "signed-by": 0 }, { "signed-by": 1 }]
                    }
                };
                adminCerts = {
                    "key": "dauto.com/users/Admin@dauto.com/msp/DetroitAuto_key",
                    "cert": "dauto.com/users/Admin@dauto.com/msp/DetroitAuto_cert.pem"
                };
                /*
                * function(channelName, [peer0URL, peer1URL], orderURL, chaincodeName, chaincodeVersion, functionName, 
                *           args, endorsementPolicy, adminUser, mspID, adminCerts)
                */
                upgradeCC.upgradeChaincode('samchannel', ['grpc://localhost:10000'], 
                    'grpc://localhost:7000', 'mycc', 'v1', null,
                    ["a", "100", "b", "200"], endorsementPolicy, 'admin', 'DetroitAuto', adminCerts).then(resolve, reject);
                break;
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







