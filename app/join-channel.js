'use strict';
/*
 * Join Channel
 * Author: Cathy Xing
 *
 */
var log4js = require('log4js');
var Fabric_Client = require('fabric-client');
var path = require('path');
var util = require('util');
var fs = require('fs');
var logger = log4js.getLogger('Join-Channel');
//logger.setLevel('DEBUG');
logger.level = 'DEBUG';

var joinChannel = function (channelName, peerURLs, orderURL, adminUser, mspID, adminCerts, peerTlsPemFile, orderTlsPemFile) {
	logger.info('============ Join Channel ' + channelName + ' ============');

	var client = new Fabric_Client();
	var channel = client.newChannel(channelName);
	// TLS
	var targets = [];
	var opt;
	if (peerTlsPemFile) {
		let data = fs.readFileSync(path.join(Fabric_Client.getConfigSetting('keyValueStore'), peerTlsPemFile));
		opt = {
			pem: Buffer.from(data).toString()
		};
	}
	for (let i = 0; i < peerURLs.length; i++) {
		let peer = client.newPeer(peerURLs[i], opt);
		targets.push(peer);
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

	var member_user = null;
	var tx_id = null;
	var store_path = Fabric_Client.getConfigSetting('keyValueStore');
	logger.info('Store path:' + store_path);

	return new Promise((resolve, reject) => {
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
			if (user_from_store && user_from_store.isEnrolled()) {
				logger.info('Successfully loaded ' + adminUser + ' from persistence');
				member_user = user_from_store;
			} else {
				throw new Error('Failed to get ' + adminUser + '.... run registerUser.js');
			}

			tx_id = client.newTransactionID();
			let request = {
				txId: tx_id
			};

			return channel.getGenesisBlock(request);
		}).then((genesis_block) => {
			tx_id = client.newTransactionID();
			var request = {
				targets: targets,
				txId: tx_id,
				block: genesis_block
			};
			let sendPromise = channel.joinChannel(request);
			return sendPromise;
		}, (err) => {
			let errMsg = 'Failed to enroll user \'' + adminUser + '\' due to error: ' + err.stack ? err.stack : err;
			logger.error(errMsg);
			throw new Error(errMsg);
		}).then((results) => {
			logger.debug(util.format('Join Channel R E S P O N S E : %j', results));
			if (results[0] && results[0].response && results[0].response.status == 200) {
			// if (results[0] && results[0][0] && results[0][0].response && results[0][0].response.status == 200) {
				let msg = util.format('Successfully joined peers in organization %s to the channel \'%s\'', mspID, channelName);
				logger.info(msg);
			//	closeConnections(true);
				let response = {
					success: true,
					message: msg
				};
				resolve(response);
			} else {
				let errMsg = ' Failed to join channel';
				logger.error(errMsg);
				//	closeConnections();
				throw new Error(errMsg);
			}

		}).catch((err) => {
			let errMsg = 'Failed to join channel :: ' + err;
			logger.error(errMsg);
			reject(errMsg);
		});
	}).catch((err) => {
		let errMsg = 'Failed to join channel :: ' + err;
		logger.error(errMsg);
		reject(errMsg);
	});;
};

exports.joinChannel = joinChannel;