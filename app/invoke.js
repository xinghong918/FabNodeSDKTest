'use strict';
/*
 * Chaincode Invoke
 */
var log4js = require('log4js');
var Fabric_Client = require('fabric-client');
var path = require('path');
var util = require('util');
var os = require('os');
var fs = require('fs-extra');
var logger = log4js.getLogger('Invoke');
//logger.setLevel('DEBUG');
logger.level = 'DEBUG';

var invokeChaincode = function (channelName, peerURLs, orderURL, chaincodeName, fcn, args, adminUser,
	peerTlsPemFile, orderTlsPemFile) {
	//
	var client = new Fabric_Client();
	var eventhubs = [];
	// setup the fabric network
	var channel = client.newChannel(channelName);
	var opt = null;
	for (let i = 0; i < peerURLs.length; i++) {
		let opt = null;;
		if (peerTlsPemFile[i]) {
			let data = fs.readFileSync(path.join(Fabric_Client.getConfigSetting('keyValueStore'), peerTlsPemFile[i]));
			opt = {
				pem: Buffer.from(data).toString()
			};
		}
		var peer = client.newPeer(peerURLs[i], opt);
		channel.addPeer(peer);
	}

	if (orderTlsPemFile) {
		let dataPem = fs.readFileSync(path.join(Fabric_Client.getConfigSetting('keyValueStore'), orderTlsPemFile));
		opt = {
			pem: Buffer.from(dataPem).toString()
		};
	}
	var order = client.newOrderer(orderURL, opt)
	channel.addOrderer(order);

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

			// an event listener can only register with a peer in its own org
			eventhubs = channel.getChannelEventHubsForOrg();

			// get a transaction id object based on the current user assigned to fabric client
			tx_id = client.newTransactionID();
			logger.info("Assigning transaction_id: ", tx_id._transaction_id);

			// createCar chaincode function - requires 5 args, ex: args: ['CAR12', 'Honda', 'Accord', 'Black', 'Tom'],
			// changeCarOwner chaincode function - requires 2 args , ex: args: ['CAR10', 'Barry'],
			// must send the proposal to endorsing peers
			var request = {
				//targets: let default to the peer assigned to the client
				chaincodeId: chaincodeName,
				fcn: fcn,
				args: args,
				txId: tx_id
			};

			// send the transaction proposal to the peers
			return channel.sendTransactionProposal(request);
		}).then((results) => {
			var proposalResponses = results[0];
			var proposal = results[1];
			let isProposalGood = false;
			logger.debug("Proposal Responses: "+proposalResponses);
			if (proposalResponses && proposalResponses[0].response &&
				proposalResponses[0].response.status === 200) {
				isProposalGood = true;
				logger.info('Transaction proposal was good');
			} else {
				logger.info('Transaction proposal was bad');
			}
			if (isProposalGood) {
				logger.debug(util.format('Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s", endorsement signature: %s', proposalResponses[0].response.status, proposalResponses[0].response.message, proposalResponses[0].response.payload, proposalResponses[0].endorsement.signature));

				// build up the request for the orderer to have the transaction committed
				var request = {
					proposalResponses: proposalResponses,
					proposal: proposal,
					txId: tx_id,
					admin: true
				};

				// set the transaction listener and set a timeout of 30 sec
				// if the transaction did not get committed within the timeout period,
				// report a TIMEOUT status
				var transaction_id_string = tx_id.getTransactionID(); //Get the transaction ID string to be used by the event processing

				// set the transaction listener and set a timeout of 30sec
				// if the transaction did not get committed within the timeout period,
				// fail the test
				var deployId = tx_id.getTransactionID();
				var eventPromises = [];
				eventhubs.forEach((eh) => {
					let txPromise = new Promise((resolve, reject) => {
						let handle = setTimeout(() => {
							eh.unregisterTxEvent(deployId);
							eh.disconnect();
							reject(new Error('REQUEST_TIMEOUT:' + deployId.toString()));
						}, 120000);

						eh.registerTxEvent(deployId, (tx, code, block_num) => {
							clearTimeout(handle);
							eh.unregisterTxEvent(deployId);

							logger.debug("code: " + code);

							if (code !== 'VALID') {
								logger.error('The balance transfer transaction was invalid, code = ' + code);
								reject(new Error('INVALID:' + code));
							} else {
								logger.info('The balance transfer transaction has been committed on peer ' + eh.getPeerAddr());
								resolve("COMMITTED");
							}
						},
							(err) => {
								clearTimeout(handle);
								eh.unregisterTxEvent(deployId);
								reject(err);
							}
						);
					});
					eh.connect(true);
					eventPromises.push(txPromise);
				});
				var sendPromise = channel.sendTransaction(request);

				return Promise.all([sendPromise].concat(eventPromises));
			} else {
				logger.error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
				throw new Error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
			}
		}).then((results) => {
			logger.info('Send transaction promise and event listener promise have completed');
			// check the results in the order the promises were added to the promise all list
			if (results && results[0] && results[0].status === 'SUCCESS') {
				logger.info('Successfully sent transaction to the orderer.');
			} else {
				let errMsg = 'Failed to order the transaction. Error code: ' + response.status;
				logger.error(errMsg);
				throw new Error(errMsg);
			}

			// if (results && results[1] && results[1].event_status === 'VALID') {
			// 	logger.info('Successfully committed the change to the ledger by the peer');
			// } else {
			// 	logger.info('Transaction failed to be committed to the ledger due to ::' + results[1].event_status);
			// }
			resolve();
		}).catch((err) => {
			let errMsg = 'Failed to invoke successfully :: ' + err;
			logger.error(errMsg);
			reject(errMsg);
		});
	});
};

exports.invokeChaincode = invokeChaincode;