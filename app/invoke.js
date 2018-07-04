'use strict';
/*
* Copyright IBM Corp All Rights Reserved
*
* SPDX-License-Identifier: Apache-2.0
*/
/*
 * Chaincode Invoke
 */
var log4js = require('log4js');
var Fabric_Client = require('fabric-client');
var path = require('path');
var util = require('util');
var os = require('os');
var logger = log4js.getLogger('Invoke');
logger.setLevel('DEBUG');

var invokeChaincode = function (channelName, peerURLs, orderURL, eventURL, chaincodeName, fcn, args, adminUser) {
	//
	var client = new Fabric_Client();

	// setup the fabric network
	var channel = client.newChannel(channelName);
	for (let i = 0; i < peerURLs.length; i++) {
		var peer = client.newPeer(peerURLs[i]);
		channel.addPeer(peer);
	}
	var order = client.newOrderer(orderURL)
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
			if (proposalResponses && proposalResponses[0].response &&
				proposalResponses[0].response.status === 200) {
				isProposalGood = true;
				logger.info('Transaction proposal was good');
			} else {
				logger.info('Transaction proposal was bad');
			}
			if (isProposalGood) {
				logger.info(util.format(
					'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s"',
					proposalResponses[0].response.status, proposalResponses[0].response.message));

				// build up the request for the orderer to have the transaction committed
				var request = {
					proposalResponses: proposalResponses,
					proposal: proposal
				};

				// set the transaction listener and set a timeout of 30 sec
				// if the transaction did not get committed within the timeout period,
				// report a TIMEOUT status
				var transaction_id_string = tx_id.getTransactionID(); //Get the transaction ID string to be used by the event processing
				var promises = [];

				var sendPromise = channel.sendTransaction(request);
				promises.push(sendPromise); //we want the send transaction first, so that we know where to check status
				// get an eventhub once the fabric client has a user assigned. The user
				// is required bacause the event registration must be signed
				let event_hub = client.newEventHub();
				event_hub.setPeerAddr(eventURL);

				// using resolve the promise so that result status may be processed
				// under the then clause rather than having the catch clause process
				// the status
				let txPromise = new Promise((resolve, reject) => {
					let handle = setTimeout(() => {
						event_hub.disconnect();
						resolve({ event_status: 'TIMEOUT' }); //we could use reject(new Error('Trnasaction did not complete within 30 seconds'));
					}, 30000);
					event_hub.connect();
					event_hub.registerTxEvent(transaction_id_string, (tx, code) => {
						// this is the callback for transaction event status
						// first some clean up of event listener
						clearTimeout(handle);
						event_hub.unregisterTxEvent(transaction_id_string);
						event_hub.disconnect();

						// now let the application know what happened
						var return_status = { event_status: code, tx_id: transaction_id_string };
						if (code !== 'VALID') {
							logger.error('The transaction was invalid, code = ' + code);
							resolve(return_status); // we could use reject(new Error('Problem with the tranaction, event status ::'+code));
						} else {
							logger.info('The transaction has been committed on peer ' + event_hub._ep._endpoint.addr);
							resolve(return_status);
						}
					}, (err) => {
						//this is the callback if something goes wrong with the event registration or processing
						reject(new Error('There was a problem with the eventhub ::' + err));
					});
				});
				promises.push(txPromise);

				return Promise.all(promises);
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
				logger.error('Failed to order the transaction. Error code: ' + response.status);
			}

			if (results && results[1] && results[1].event_status === 'VALID') {
				logger.info('Successfully committed the change to the ledger by the peer');
			} else {
				logger.info('Transaction failed to be committed to the ledger due to ::' + results[1].event_status);
			}
			resolve();
		}).catch((err) => {
			let errMsg = 'Failed to invoke successfully :: ' + err;
			logger.error(errMsg);
			reject(errMsg);
		});
	});
};

exports.invokeChaincode = invokeChaincode;