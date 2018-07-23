'use strict';
/*
 * Chaincode Event Testing
 * Author: Cathy Xing
 * 
 */

var Fabric_Client = require('fabric-client');
var path = require('path');
var fs = require('fs-extra');
var log4js = require('log4js');
var logger = log4js.getLogger('CCEvent');
logger.setLevel('DEBUG');

var chaincodeEvent = function (eventURL, chaincodeName, eventName, adminUser, peerTlsPemFile) {
	//
	var client = new Fabric_Client();

	//
	var member_user = null;
	var store_path = Fabric_Client.getConfigSetting('keyValueStore');
	logger.info('Store path:' + store_path);
	var tx_id = null;

	return new Promise((resolve, reject) => {
		// create the key value store as defined in the fabric-client/config/default.json 'key-value-store' setting
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

			// Chaincode Event Register
			let event_hub = client.newEventHub();

			var opt = {};
			if (peerTlsPemFile) {
				let data = fs.readFileSync(path.join(Fabric_Client.getConfigSetting('keyValueStore'), peerTlsPemFile));
				opt.pem = Buffer.from(data).toString();
			}
			event_hub.setPeerAddr(eventURL, opt);

			let handle = event_hub.registerChaincodeEvent(chaincodeName, eventName, (event, block_num, tx_id, status) => {
				logger.info("Chaincode event happened!");
			//	logger.info("Event:" +JSON.stringify(event, null, 2));
				logger.info("From chaincode_id: " + event.chaincode_id + ", tx_id: " + event.tx_id + ", event_name: " + event.event_name);
				logger.info("Payload Data: " + event.payload.toString() );

				// Event form:
				// {
				// 	"chaincode_id": "mycc1",
				// 	"tx_id": "d215b7365af534b40d7bbc443099ccc977c2eb34974777319f99a0523e61674b",
				// 	"event_name": "testEvent",
				// 	"payload": {
				// 	  "type": "Buffer",
				// 	  "data": [
				// 		115,
				// 		115,
				// 		100,
				// 		100
				// 	  ]
				// 	}
				// }

				event_hub.unregisterChaincodeEvent(handle);
				event_hub.disconnect();
			}, (err) => {
				//this is the callback if something goes wrong with the event registration or processing
				logger.error('There was a problem with the eventhub ::' + err);
				return;
			});

			logger.info("Connecting to event hub...");
			event_hub.connect();

		}).then((results) => {
			resolve();
		}).catch((err) => {
			let errMsg = 'Failed to invoke successfully :: ' + err;
			logger.error(errMsg);
			reject(errMsg);
		});

	});

};

exports.chaincodeEvent = chaincodeEvent;