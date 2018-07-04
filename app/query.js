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

var queryChaincode = function (channelName, peerURL, chaincodeName, fcn, args, adminUser) {

	logger.info('============ Query chaincode ============');
	//
	var client = new Fabric_Client();
	// setup the fabric network
	var channel = client.newChannel(channelName);
	// endable TLS
	// let data = fs.readFileSync(path.join(__dirname, 'hfc-key-store/ca.crt'));
	// var peer = client.newPeer('grpcs://localhost:7051', {
	// 	pem: Buffer.from(data).toString(),
	// 	'ssl-target-name-override': 'peer0.org1.example.com'
	// });
	// peer.setName('peer1');
	var peer = client.newPeer(peerURL);
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
			var crypto_store = Fabric_Client.newCryptoKeyStore({ path: store_path });
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


exports.queryChaincode = queryChaincode;