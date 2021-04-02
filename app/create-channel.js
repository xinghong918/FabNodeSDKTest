'use strict';
/*
 * Create Channel
 * Author: Cathy Xing
 *
 */
var log4js = require('log4js');
var Fabric_Client = require('fabric-client');
var path = require('path');
var fs = require('fs');
var util = require('util');
var configtxlator = require('./configtxlator.js');
var logger = log4js.getLogger('Create-Channel');
//logger.setLevel('DEBUG');
logger.level = 'DEBUG';

var createChannel = function (channelName, peerURL, orderURL, channelConfigPath, adminUser, mspID, 
                              adminCerts, peerTlsPemFile, orderTlsPemFile) {
    logger.info('============ Creating Channel ' + channelName + ' ============');

    var client = new Fabric_Client();
    var channel = client.newChannel(channelName);
    // TLS
	var opt;
	if (peerTlsPemFile) {
		let data = fs.readFileSync(path.join(Fabric_Client.getConfigSetting('keyValueStore'), peerTlsPemFile));
		opt = {
			pem: Buffer.from(data).toString()
		};
	}
	var peer = client.newPeer(peerURL, opt);
	channel.addPeer(peer);
	
	opt = null;
	if (orderTlsPemFile) {
		let dataPem = fs.readFileSync(path.join(Fabric_Client.getConfigSetting('keyValueStore'), orderTlsPemFile));
		opt = {
			pem: Buffer.from(dataPem).toString()
		};
	}
	var order = client.newOrderer(orderURL, opt)
	channel.addOrderer(order);

    var member_user = null;
    var store_path = Fabric_Client.getConfigSetting('keyValueStore');
	logger.info('Store path:' + store_path);

    return new Promise(function (resolve, reject) {
        // Get Org Admin first
        var keyPath = path.join(__dirname, Fabric_Client.getConfigSetting('adminPath'), adminCerts.key);
        let keyData = fs.readFileSync(keyPath);
        var keyPEM = Buffer.from(keyData).toString();
        var certPath = path.join(__dirname, Fabric_Client.getConfigSetting('adminPath'), adminCerts.cert);
        let certData = fs.readFileSync(certPath);
        var certPEM = certData.toString();

        var cryptoSuite = Fabric_Client.newCryptoSuite();
        cryptoSuite.setCryptoKeyStore(Fabric_Client.newCryptoKeyStore({
            path: store_path
        }));
        client.setCryptoSuite(cryptoSuite);

        Fabric_Client.newDefaultKeyValueStore({
            path: store_path
        }).then((state_store) => {
            // assign the store to the fabric client
            client.setStateStore(state_store);

            return client.createUser({
                username: adminUser,
                mspid: mspID,
                cryptoContent: {
                    privateKeyPEM: keyPEM,
                    signedCertPEM: certPEM
                }
            });
        }).then((user_from_store) => {
            logger.debug(util.format('Successfully acquired admin user for the organization'));
            member_user = user_from_store;
            // read in the envelope for the channel config raw bytes
            var envelope = fs.readFileSync(path.join(__dirname, channelConfigPath));
            // extract the channel config bytes from the envelope to be signed
            var channelConfig = client.extractChannelConfig(envelope);

            // sign the channel config bytes as "endorsement", this is required by
            // the orderer's channel creation policy
            let signature = client.signChannelConfig(channelConfig);

            let request = {
                config: channelConfig,
                signatures: [signature],
                name: channelName,
                orderer: channel.getOrderers()[0],
                txId: client.newTransactionID()
            };

            // send to orderer
            return client.createChannel(request);
        }, (err) => {
            logger.error('Failed to enroll user \'' + adminUser + '\'. ' + err);
            throw new Error('Failed to enroll user \'' + adminUser + '\'. ' + err);
        }).then((response) => {
            logger.debug(' response ::%j', response);
            if (response && response.status === 'SUCCESS') {
                logger.debug('Successfully created the channel:'+channelName);
                let response = {
                    success: true,
                    message: 'Channel \'' + channelName + '\' created Successfully'
                };
              resolve(response);
            } else {
                let errMsg = 'Failed to create the channel \'' + channelName;
                logger.error('\n!!!!!!!!! '+ errMsg +' !!!!!!!!!\n\n');
                throw new Error(errMsg);
            }
        } , (err) => {
            let errMsg = 'Failed to initialize the channel: ' + err.stack ? err.stack :err;
            logger.error(errMsg);
            throw new Error(errMsg);
        })
        .catch((err) => {
            logger.error('Failed to create channel: ' + channelName + ' :: ' + err);
            reject(err);
        });
    });


};


/**
 * @param {*} blockPath orginal 'common.Envelope' block path. e.g. channel.tx
 * @param {*} policies 
 * "policies": {
        "Readers": {"mspids": ["DetroitAuto", "SamDealer"]},
        "Writers": {"mspids": ["DetroitAuto"]}
    }

    curl -X POST --data-binary @mychannel.json http://127.0.0.1:7059/protolator/encode/common.Envelope > mychannel.tx

    updateCreateChannelBlockACL('../artifacts/channel/channel.tx', {
        "Readers": {"mspids": ["DetroitAuto", "SamDealer"]},
        "Writers": {"mspids": ["DetroitAuto"]}
    }, 'DetroitAuto');
 */
var updateCreateChannelBlockACL = function(blockPath, policies, cur_mspId){
    logger.info('============ Change Update Create Channel Block ACL for ' + blockPath + ' ============');
    var blockFilePath = path.join(__dirname, blockPath);
    logger.info(blockFilePath);
    let block = fs.readFileSync(blockFilePath);
    var envelope = {};
    if (typeof policies === 'object' && Object.keys(policies).length > 0) {
        var txlator = new configtxlator();
        return txlator.decode(block, 'common.Envelope').then(envelop_json=> {
                envelope = JSON.parse(envelop_json);
                var CREATOR_TAG = "Creator";
                var policy_group = envelope.payload.data.config_update.write_set.groups.Application.policies;
                for (var key in policies) {
                    if (policies.hasOwnProperty(key)) {
                        //
                        var newpolicy = {
                            mod_policy: CREATOR_TAG,
                            policy : { 
                                type : 1,
                                value : {
                                     identities: [
                                         //{
                                         //    principal: {
                                         //        msp_identifier: this.mspid
                                         //    }
                                         //}
                                     ],
                                     rule: {
                                         n_out_of: {
                                             n: 1,
                                             rules: [
                                                 //{
                                                 //    signed_by: 0
                                                 //}
                                             ]
                                         }
                                     }
                                }
                            }
                        };
                        //
                        if (!policies[key].hasOwnProperty('mspids')) {
                            logger.error("Missing MSPID in policy configuration")
                            return Promise.reject("Missing MSPID in policy configuration");
                        }
                        var i = 0;
                        policies[key].mspids.forEach(function( mspid) {
                            var id = {
                                principal: {
                                    msp_identifier: mspid
                                }
                            }
                            var rule = {
                                signed_by : i
                            }
                            newpolicy.policy.value.identities.push(id)
                            newpolicy.policy.value.rule.n_out_of.rules.push(rule)
                            i++
                        });
                        policy_group[key] = newpolicy;
                    }
                }
                //Add a new  creator policy for application
            //    var cur_mspId = process.env.BCS_CLOUD_STACKNAME;
                let creator_policy = {
                    mod_policy: "Admins",
                    policy: {
                        type: 1,
                        value: {
                            identities: [
                                {
                                    principal: {
                                        msp_identifier: cur_mspId,
                                        "role": "ADMIN"
                                    }
                                }
                            ],
                            rule: {
                                n_out_of: {
                                    n: 1,
                                    rules: [
                                        {
                                            signed_by: 0
                                        }
                                    ]
                                }
                            }
                        }
                    }
                };

                policy_group[CREATOR_TAG] = creator_policy;
                envelope.payload.data.config_update.write_set.groups.Application.mod_policy = "Creator";
                return txlator.encode(JSON.stringify(envelope, null, 4), 'common.Envelope');
            //    return txlator.encode(JSON.stringify(envelope, null, 4), 'common.Envelope');
            }).then(updated_block=> {
                logger.info('========= Done Change Update Create Channel Block ACL for: '+ blockFilePath +' ==========');
                fs.writeFileSync(blockFilePath, updated_block);
                return Promise.resolve(updated_block);
            }, err=> {
                logger.error('Encode updated create channel envelope failed, error=%s', err);
                return Promise.reject(err);
            }).catch((err)=>{
                logger.error('Exception updated create channel envelope, error=%s', err);
                return Promise.reject(err);
            });
    } else {
        return Promise.resolve(block);
    }
};


exports.createChannel = createChannel;
exports.updateCreateChannelBlockACL = updateCreateChannelBlockACL;