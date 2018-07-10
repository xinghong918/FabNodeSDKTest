'use strict';
/*
 * Copyright IBM Corp All Rights Reserved
 *
 * SPDX-License-Identifier: Apache-2.0
 */
/*
 * Chaincode query
 */

var log4js = require('log4js');
var Fabric_Client = require('fabric-client');
var path = require('path');
var util = require('util');
var os = require('os');
var fs = require('fs-extra');
var logger = log4js.getLogger('Query');
logger.setLevel('DEBUG');

var queryChaincode = function (channelName, peerURL, chaincodeName, fcn, args, adminUser, peerTlsPemFile) {
	logger.info('============ Query chaincode ============');
	//
	var client = new Fabric_Client();
	// setup the fabric network
	var channel = client.newChannel(channelName);
	var peer;
	// endable TLS
	if (peerTlsPemFile) {
		let data = fs.readFileSync(path.join(Fabric_Client.getConfigSetting('keyValueStore'), peerTlsPemFile));
		var peer = client.newPeer(peerURL, {
			pem: Buffer.from(data).toString()
		});
		//	peer.setName('peer0-1');
	} else {
		peer = client.newPeer(peerURL);
	}

	channel.addPeer(peer);


	//
	var member_user = null;
	var store_path = Fabric_Client.getConfigSetting('keyValueStore');
	logger.info('Store path:' + store_path);
	var tx_id = null;

	// create the key value store as defined in the fabric-client/config/default.json 'key-value-store' setting
	return new Promise((resolve, reject) => {
		Fabric_Client.newDefaultKeyValueStore({
			path: store_path
		}).then((state_store) => {
			// assign the store to the fabric client
			client.setStateStore(state_store);
			var crypto_suite = Fabric_Client.newCryptoSuite();
			// use the same location for the state store (where the users' certificate are kept)
			// and the crypto store (where the users' keys are kept)
			var crypto_store = Fabric_Client.newCryptoKeyStore({
				path: store_path
			});
			crypto_suite.setCryptoKeyStore(crypto_store);
			client.setCryptoSuite(crypto_suite);

			// get the enrolled user from persistence, this user will sign all requests
			return client.getUserContext(adminUser, true);
		}).then((user_from_store) => {
			if (user_from_store && user_from_store.isEnrolled()) {
				logger.info('Successfully loaded ' + adminUser + ' from persistence');
				member_user = user_from_store;
			} else {
				throw new Error('Failed to get ' + adminUser + '.... run registerUser.js');
			}

			// queryCar chaincode function - requires 1 argument, ex: args: ['CAR4'],
			// queryAllCars chaincode function - requires no arguments , ex: args: [''],
			const request = {
				//targets : --- letting this default to the peers assigned to the channel
				chaincodeId: chaincodeName,
				fcn: fcn,
				args: args
			};

			// send the query proposal to the peer
			return channel.queryByChaincode(request);
		}).then((query_responses) => {
			logger.info("Query has completed, checking results");
			// query_responses could have more than one  results if there multiple peers were used as targets
			if (query_responses && query_responses.length == 1) {
				if (query_responses[0] instanceof Error) {
					logger.error("error from query = ", query_responses[0]);
				} else {
					logger.info("Response is ", query_responses[0].toString());
				}
			} else {
				logger.info("No payloads were returned from query");
			}
			resolve();
		}).catch((err) => {
			logger.error('Failed to query :: ' + err);
			reject(err);
		});
	});
};


var getChainInfo = function (channelName, peerURL, adminUser, peerTlsPemFile) {
	logger.info('============ Query ChainInfo: ' + channelName + ' ============');
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

	var member_user = null;
	var store_path = Fabric_Client.getConfigSetting('keyValueStore');
	logger.info('Store path:' + store_path);

	return new Promise((resolve, reject) => {
		Fabric_Client.newDefaultKeyValueStore({
			path: store_path
		}).then((state_store) => {
			// assign the store to the fabric client
			client.setStateStore(state_store);
			var crypto_suite = Fabric_Client.newCryptoSuite();
			// use the same location for the state store (where the users' certificate are kept)
			// and the crypto store (where the users' keys are kept)
			var crypto_store = Fabric_Client.newCryptoKeyStore({
				path: store_path
			});
			crypto_suite.setCryptoKeyStore(crypto_store);
			client.setCryptoSuite(crypto_suite);

			// get the enrolled user from persistence, this user will sign all requests
			return client.getUserContext(adminUser, true);
		}).then((user_from_store) => {
			if (user_from_store && user_from_store.isEnrolled()) {
				logger.info('Successfully loaded ' + adminUser + ' from persistence');
				member_user = user_from_store;
			} else {
				throw new Error('Failed to get ' + adminUser + '.... run registerUser.js');
			}

			return channel.queryInfo(peer);
		}).then((blockchainInfo) => {
			if (blockchainInfo) {
				// FIXME: Save this for testing 'getBlockByHash'  ?
				logger.debug('===========================================');
				logger.debug(blockchainInfo.currentBlockHash);
				logger.debug('===========================================');
				//logger.debug(blockchainInfo);
				resolve(blockchainInfo);
			} else {
				throw new Error('response_payloads is null');
			}
		}, (err) => {
			let errMsg = 'Failed to query Chain Info due to error: ' + err.stack ? err.stack : err;
			logger.error(errMsg);
			return errMsg;
		}).catch((err) => {
			let errMsg = 'Failed to query Chain Info with error:' + err.stack ? err.stack : err;
			logger.error(errMsg);
			reject(errMsg);
		});
	});
};



exports.queryChaincode = queryChaincode;
exports.getChainInfo = getChainInfo;