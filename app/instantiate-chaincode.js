'use strict';
/*
 * Instantiate Chaincode
 * Author: Cathy Xing
 * 
 */
var log4js = require('log4js');
var Fabric_Client = require('fabric-client');
var path = require('path');
var fs = require('fs');
var util = require('util');
var logger = log4js.getLogger('Instantiate-Chaincode');
//logger.setLevel('DEBUG');
logger.level = 'DEBUG';

var instantiateChaincode = function (channelName, peerURLs, orderURL, chaincodeName, chaincodeVersion, functionName, 
		args, endorsementPolicy, adminUser, mspID, adminCerts, peerTlsPemFile, orderTlsPemFile) {
	logger.info('============ Instantiate chaincode on organization ============');

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
	for (let i = 0; i < peerURLs.length; i++) {
		var peer = client.newPeer(peerURLs[i], opt);
		channel.addPeer(peer);
	}
	
	opt = null;
	if (orderTlsPemFile) {
		let dataPem = fs.readFileSync(path.join(Fabric_Client.getConfigSetting('keyValueStore'), orderTlsPemFile));
		opt = {
			pem: Buffer.from(dataPem).toString()
		};
	}
	var order = client.newOrderer(orderURL, opt)
	channel.addOrderer(order);

	var tx_id = null;
	var store_path = Fabric_Client.getConfigSetting('keyValueStore');
	logger.info('Store path:' + store_path);


	// create the key value store as defined in the fabric-client/config/default.json 'key-value-store' setting
	return new Promise(function (resolve, reject) {
		var keyPath = path.join(__dirname, Fabric_Client.getConfigSetting('adminPath'), adminCerts.key);
		let keyData = fs.readFileSync(keyPath);
		var keyPEM = Buffer.from(keyData).toString();
		var certPath = path.join(__dirname, Fabric_Client.getConfigSetting('adminPath'), adminCerts.cert);
		let certData = fs.readFileSync(certPath);
		var certPEM = certData.toString();

		var cryptoSuite = Fabric_Client.newCryptoSuite();
		cryptoSuite.setCryptoKeyStore(Fabric_Client.newCryptoKeyStore({path: store_path }));
		client.setCryptoSuite(cryptoSuite);

		// get org admin first
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
			logger.info('Successfully enroll ' + adminUser);

			// ...
			return channel.initialize();
		}, (err) => {
			logger.error('Failed to enroll user \'' + adminUser + '\'. ' + err);
			throw new Error('Failed to enroll user \'' + adminUser + '\'. ' + err);
		}).then((success) => {
			logger.info('Successfully initialize the channel.');
			tx_id = client.newTransactionID();
			// send proposal to endorser
			var request = {
				chaincodeId: chaincodeName,
				chaincodeVersion: chaincodeVersion,
				args: args,
				txId: tx_id
			};

			if (functionName)
				request.fcn = functionName;

			if (endorsementPolicy)
				request["endorsement-policy"] = endorsementPolicy;

			return channel.sendInstantiateProposal(request);
		}, (err) => {
			let errMsg = 'Failed to initialize the channel';
			logger.error(errMsg);
			throw new Error(errMsg);
		}).then((results)=>{
			var proposalResponses = results[0];
			var proposal = results[1];
			var all_good = true;
			for (var i in proposalResponses) {
				let one_good = false;
				logger.debug("Proposal Responses: " + proposalResponses);
				if (proposalResponses && proposalResponses[i].response &&
					proposalResponses[i].response.status === 200) {
					one_good = true;
					logger.info('instantiate proposal was good');
				} else {
					logger.error('instantiate proposal was bad');
				}
				all_good = all_good & one_good;
			}
			if (all_good) {
				logger.info(util.format(
					'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s", endorsement signature: %s',
					proposalResponses[0].response.status, proposalResponses[0].response.message,
					proposalResponses[0].response.payload, proposalResponses[0].endorsement
					.signature));
				var request = {
					proposalResponses: proposalResponses,
					proposal: proposal
				};
				
				return channel.sendTransaction(request).then((results) => {
					logger.debug('Successfully instantiate chaincode!');
					resolve(results[0]); // the first returned value is from the 'sendPromise' which is from the 'sendTransaction()' call
				}).catch((err) => {
					let errMsg = util.format('Failed to send instantiate transaction and get notifications within the timeout period. %s', err);
					logger.error(errMsg);
					reject(errMsg);
				});
			} else {
				let errMsg = 'Failed to send instantiate Proposal or receive valid response. Response null or status is not 200. exiting...';
				logger.error(errMsg);
				reject(errMsg);
			}

		}, (err)=>{
			let errMsg = 'Failed to send instantiate proposal due to error: ' + err.stack ? err.stack : err;
			logger.error(errMsg);
			reject(errMsg);
		}).catch((err) => {
			logger.error('Failed to instantiate :: ' + err);
			reject(err);
		});
	});

};
exports.instantiateChaincode = instantiateChaincode;

