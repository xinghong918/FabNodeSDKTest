'use strict';
/*
 * Install Chaincode
 * Author: Cathy Xing
 * 
 */
var log4js = require('log4js');
var Fabric_Client = require('fabric-client');
var path = require('path');
var fs = require('fs');
var logger = log4js.getLogger('Install-Chaincode');
logger.setLevel('DEBUG');


var installChaincode = function (channelName, peerURLs, orderURL, chaincodePath, chaincodeName, chaincodeVersion, 
		adminUser, mspID, adminCerts) {
	logger.info('============ Install chaincode on organizations ============');
	// setup Chaincode Deploy
	process.env.GOPATH = path.join(__dirname, Fabric_Client.getConfigSetting('CC_SRC_PATH'));

	var client = new Fabric_Client();
	var channel = client.newChannel(channelName);
	var order = client.newOrderer(orderURL);
	channel.addOrderer(order);
	// No TLS
	let targets = [];
	for (let i = 0; i < peerURLs.length; i++) {
		let peer = client.newPeer(peerURLs[i]);
		targets.push(peer);
	}
	

	var store_path = Fabric_Client.getConfigSetting('keyValueStore');
	logger.info('Store path:' + store_path);


	// create the key value store as defined in the fabric-client/config/default.json 'key-value-store' setting
	return new Promise( (resolve, reject) => {
		var keyPath = path.join(__dirname, Fabric_Client.getConfigSetting('adminPath'), adminCerts.key);
		let keyData = fs.readFileSync(keyPath);
		var keyPEM = Buffer.from(keyData).toString();
		var certPath = path.join(__dirname, Fabric_Client.getConfigSetting('adminPath'), adminCerts.cert);
		let certData = fs.readFileSync(certPath);
		var certPEM = certData.toString();

		var cryptoSuite = Fabric_Client.newCryptoSuite();
		cryptoSuite.setCryptoKeyStore(Fabric_Client.newCryptoKeyStore({path: store_path }));
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
			logger.info('Successfully enroll ' + adminUser);

			var request = {
				targets: targets,
				chaincodePath: chaincodePath,
				chaincodeId: chaincodeName,
				chaincodeVersion: chaincodeVersion
			};
			return client.installChaincode(request);

		}, (err) => {
			logger.error('Failed to enroll user \'' + adminUser + '\'. ' + err);
			throw new Error('Failed to enroll user \'' + adminUser + '\'. ' + err);
		}).then((results) => {
			logger.info('Done chaincode installation.');
			var proposalResponses = results[0];
			var proposal = results[1];
			var all_good = true;
			for (var i in proposalResponses) {
				let one_good = false;
				if (proposalResponses && proposalResponses[i].response &&
					proposalResponses[i].response.status === 200) {
					one_good = true;
					logger.info('install proposal was good');
				} else {
					logger.error('install proposal was bad');
				}
				all_good = all_good & one_good;
			}
			if (all_good) {
				// logger.info(util.format(
				// 	'Successfully sent install Proposal and received ProposalResponse: Status - %s',
				// 	proposalResponses[0].response.status));
				logger.info('Successfully Installed chaincode on organization ');
				resolve();
			} else {
				let errMsg = 'Failed to send install Proposal or receive valid response. Response null or status is not 200. exiting...'
				logger.error(errMsg);
				reject(errMsg);
			}
		}, (err) => {
			let errMsg = 'Failed to send install proposal due to error: ' + err.stack ? err.stack : err;
			logger.error(errMsg);
			throw new Error(errMsg);
		}).catch((err) => {
			logger.error('Failed to install chaincode :: ' + err);
			reject(err);
		});
	});

};
exports.installChaincode = installChaincode;

