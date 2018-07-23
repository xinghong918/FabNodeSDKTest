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
var logger = log4js.getLogger('BlockEvent');
logger.setLevel('DEBUG');

var blockEvent = function (eventURL, adminUser, peerTlsPemFile) {
	//
	var client = new Fabric_Client();

	//
	var store_path = Fabric_Client.getConfigSetting('keyValueStore');
	logger.info('Store path:' + store_path);

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

			let handle = event_hub.registerBlockEvent((block) => {
				logger.info("Block event happened!");
			//	logger.info("Event:" + JSON.stringify(block, null, 2));

				let first_tx = block.data.data[0]; // get the first transaction
				let header = first_tx.payload.header; // the "header" object contains metadata of the transaction
				let channel_id = header.channel_header.channel_id;
				let tx_id = header.channel_header.tx_id;
				let block_num = block.header.number;
				let action = first_tx.payload.data.actions[0].payload.action;
				let events = action.proposal_response_payload.extension.events;
				let chaincode_id = events.chaincode_id, 
					input = first_tx.payload.data.actions[0].payload.chaincode_proposal_payload.input;
				logger.info("Block from channel: " + channel_id + ", block #: " + block_num + ", TxID: " + tx_id);
				logger.info("chaincode_id: "+chaincode_id);
				logger.info("input: "+input);

				event_hub.unregisterBlockEvent(handle);
				event_hub.disconnect();
				resolve();
			}, (err) => {
				//this is the callback if something goes wrong with the event registration or processing
				logger.error('There was a problem with the eventhub ::' + err);
				return;
			});

			logger.info("Connecting to event hub...");
			event_hub.connect();

		}).catch((err) => {
			let errMsg = 'Failed to listen on block event :: ' + err;
			logger.error(errMsg);
			reject(errMsg);
		});

	});

};

exports.blockEvent = blockEvent;


//  Event form: 
// {
// 	"header": {
// 		"number": "74",
// 		"previous_hash": "044a65b72eada4531160aac59bb46ea386160bd0db476adcf28e14cb2d2d4706",
// 		"data_hash": "ac081ced5fb374a7fcb276bd27d1d44316da35938edd5a7fa3b0f0f97044c038"
// 	},
// 	"data": {
// 		"data": [{
// 			"signature": {
// 				"type": "Buffer",
// 				"data": [
// 					103,
// 					92,
// 					62
// 				]
// 			},
// 			"payload": {
// 				"header": {
// 					"channel_header": {
// 						"type": "ENDORSER_TRANSACTION",
// 						"version": 3,
// 						"timestamp": "Mon Jul 23 2018 13:01:37 GMT+0800 (中国标准时间)",
// 						"channel_id": "xh",
// 						"tx_id": "e57cc07d968611fef6a32a2b2103f2a6afb3a5a85b0905deade40287e0aa016b",
// 						"epoch": 0,
// 						"extension": {
// 							"type": "Buffer",
// 							"data": [
// 								18,
// 								7,
// 								49
// 							]
// 						}
// 					},
// 					"signature_header": {
// 						"creator": {
// 							"Mspid": "bcdcdev",
// 							"IdBytes": "-----BEGIN CERTIFICATE-----\nMIIB+jCCAaGgAwIBAgIUHxMUcBHRK4Az+ClVnFcj3gSuCy0wCgYIKoZIzj0EAwIw\nJDEQMA4GA1UEChMHYmNkY2RldjEQMA4GA1UEAxMHYmNkY2RldjAeFw0xODA3MTAw\nNDIzMDBaFw0xOTA3MTAwNDIzMDBaMBwxGjAYBgNVBAMTEWJjZGNkZXZyZXN0cHJv\neHkxMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAESmuTjA0n8PwrOmcKH1Hsl1Jo\n+G2NAho03i139gpUIKF9sTeEl94qDNCSy9XXmgUdfC6TG8E0GEsWEIuiQzPsyqOB\nuDCBtTAOBgNVHQ8BAf8EBAMCB4AwDAYDVR0TAQH/BAIwADAdBgNVHQ4EFgQUpgX6\nlqTNH/Fha+a6pQptUbDEC/0wHwYDVR0jBBgwFoAUMrutefxcds/VHEf5wYBsP9EO\nYEUwVQYDVR0RBE4wTIIJbG9jYWxob3N0gj83RDVCQUFFMDBFMTI0RjdDQTJGQTg4\nMjI3QkMzMDgxOC5ibG9ja2NoYWluLm9jcC5vcmFjbGVjbG91ZC5jb20wCgYIKoZI\nzj0EAwIDRwAwRAIgeSV/7IFpdy4/KgjudhD3bnPa/JEZyONe/fG753Aw/4wCIGfK\nCj/WaYcm3lbZmyuD9+RX2R9E8EHA0FMfNljqorTg\n-----END CERTIFICATE-----\n"
// 						},
// 						"nonce": {
// 							"type": "Buffer",
// 							"data": [
// 								96,
// 								198,
// 								7
// 							]
// 						}
// 					}
// 				},
// 				"data": {
// 					"actions": [{
// 						"header": {
// 							"creator": {
// 								"Mspid": "bcdcdev",
// 								"IdBytes": "-----BEGIN CERTIFICATE-----\nMIIB+jCCAaGgAwIBAgIUHxMUcBHRK4Az+ClVnFcj3gSuCy0wCgYIKoZIzj0EAwIw\nJDEQMA4GA1UEChMHYmNkY2RldjEQMA4GA1UEAxMHYmNkY2RldjAeFw0xODA3MTAw\nNDIzMDBaFw0xOTA3MTAwNDIzMDBaMBwxGjAYBgNVBAMTEWJjZGNkZXZyZXN0cHJv\neHkxMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAESmuTjA0n8PwrOmcKH1Hsl1Jo\n+G2NAho03i139gpUIKF9sTeEl94qDNCSy9XXmgUdfC6TG8E0GEsWEIuiQzPsyqOB\nuDCBtTAOBgNVHQ8BAf8EBAMCB4AwDAYDVR0TAQH/BAIwADAdBgNVHQ4EFgQUpgX6\nlqTNH/Fha+a6pQptUbDEC/0wHwYDVR0jBBgwFoAUMrutefxcds/VHEf5wYBsP9EO\nYEUwVQYDVR0RBE4wTIIJbG9jYWxob3N0gj83RDVCQUFFMDBFMTI0RjdDQTJGQTg4\nMjI3QkMzMDgxOC5ibG9ja2NoYWluLm9jcC5vcmFjbGVjbG91ZC5jb20wCgYIKoZI\nzj0EAwIDRwAwRAIgeSV/7IFpdy4/KgjudhD3bnPa/JEZyONe/fG753Aw/4wCIGfK\nCj/WaYcm3lbZmyuD9+RX2R9E8EHA0FMfNljqorTg\n-----END CERTIFICATE-----\n"
// 							},
// 							"nonce": {
// 								"type": "Buffer",
// 								"data": [
// 									96,
// 									198,
// 									7
// 								]
// 							}
// 						},
// 						"payload": {
// 							"chaincode_proposal_payload": {
// 								"input": {
// 									"type": "Buffer",
// 									"data": [
// 										10,
// 										102
// 									]
// 								}
// 							},
// 							"action": {
// 								"proposal_response_payload": {
// 									"proposal_hash": "c4a5e79acf994192bc333bd0e38aeca1204d7f442e7b3f4f931424e219092009",
// 									"extension": {
// 										"results": {
// 											"data_model": 0,
// 											"ns_rwset": []
// 										},
// 										"events": {
// 											"chaincode_id": "mycc1",
// 											"tx_id": "e57cc07d968611fef6a32a2b2103f2a6afb3a5a85b0905deade40287e0aa016b",
// 											"event_name": "testEvent",
// 											"payload": {
// 												"type": "Buffer",
// 												"data": [
// 													102,
// 													102
// 												]
// 											}
// 										},
// 										"response": {
// 											"status": 200,
// 											"message": "",
// 											"payload": "ff"
// 										}
// 									}
// 								},
// 								"endorsements": [{
// 										"endorser": {
// 											"Mspid": "bcdcdev",
// 											"IdBytes": "-----BEGIN -----\nMIIB/DCCAaKgAwIBAgIUHxg+Zu0KvrOA4zZdVVdmqvZJK+QwCgYIKoZIzj0EAwIw\nJDEQMA4GA1UEChMHYmNkY2RldjEQMA4GA1UEAxMHYmNkY2RldjAeFw0xODA3MTAw\nNDIyMDBaFw0xOTA3MTAwNDIyMDBaMBgxFjAUBgNVBAMTDWJjZGNkZXYycGVlcjAw\nWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAASyvnJNMlsakxpqgYpiBoZvNCSdt6N6\nl4QSUw4pVQGE2fH9YNGWJPCgVGhGlbYse2er+ybwLBzruiOjmM+jjilfo4G9MIG6\nMA4GA1UdDwEB/wQEAwIHgDAMBgNVHRMBAf8EAjAAMB0GA1UdDgQWBBTKYnkHDCBf\nrYo62ZPN8NfSbaylyTAfBgNVHSMEGDAWgBQyu615/Fx2z9UcR/nBgGw/0Q5gRTBa\nBgNVHREEUzBRgglsb2NhbGhvc3SCRDdENUJBQUUwMEUxMjRGN0NBMkZBODgyMjdC\nQzMwODE4LW1nbXQuYmxvY2tjaGFpbi5vY3Aub3JhY2xlY2xvdWQuY29tMAoGCCqG\nSM49BAMCA0gAMEUCIQCSMFZU3FROZ55f0mODOgGwtuIG7wOhwB1yZU2FXV+DfQIg\nFD2CTqyUx4aXcigK0BIW+Pl0iF7I6Nl3/ITI85tHv/w=\n-----END -----\n"
// 										},
// 										"signature": {
// 											"type": "Buffer",
// 											"data": [
// 												48,
// 												177
// 											]
// 										}
// 									},
// 									{
// 										"endorser": {
// 											"Mspid": "bcdcdev",
// 											"IdBytes": "-----BEGIN -----\nMIIB+zCCAaKgAwIBAgIUbZiJSZhD8S33jVlh3N6/fknAKOEwCgYIKoZIzj0EAwIw\nJDEQMA4GA1UEChMHYmNkY2RldjEQMA4GA1UEAxMHYmNkY2RldjAeFw0xODA3MTAw\nNDIxMDBaFw0xOTA3MTAwNDIxMDBaMBgxFjAUBgNVBAMTDWJjZGNkZXYxcGVlcjAw\nWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAASPrLTHIGyCV4ebP7qL7Nif1aC1hfq6\nCJ1hDq9k4/Bmq0fn6AFcdi/pfHKWm/WB88VD2rvwuNjKPf9lFSErWZwdo4G9MIG6\nMA4GA1UdDwEB/wQEAwIHgDAMBgNVHRMBAf8EAjAAMB0GA1UdDgQWBBS0kMhp26vh\n7nAwaUyvfGCOo/URfDAfBgNVHSMEGDAWgBQyu615/Fx2z9UcR/nBgGw/0Q5gRTBa\nBgNVHREEUzBRgglsb2NhbGhvc3SCRDdENUJBQUUwMEUxMjRGN0NBMkZBODgyMjdC\nQzMwODE4LW1nbXQuYmxvY2tjaGFpbi5vY3Aub3JhY2xlY2xvdWQuY29tMAoGCCqG\nSM49BAMCA0cAMEQCIG3RnOAI+4q9rc6FPA+inSWBrg5P46x+8SSpETR9laq6AiAn\nzRKyUXXnzs75qbdYR9U8HBb3/RhJ2Xq5s1CE1RXbLg==\n-----END -----\n"
// 										},
// 										"signature": {
// 											"type": "Buffer",
// 											"data": [
// 												48,
// 												105
// 											]
// 										}
// 									}
// 								]
// 							}
// 						}
// 					}]
// 				}
// 			}
// 		}]
// 	},
// 	"metadata": {
// 		"metadata": [{
// 				"value": "",
// 				"signatures": [{
// 					"signature_header": {
// 						"creator": {
// 							"Mspid": "bcdcdev",
// 							"IdBytes": "-----BEGIN -----\nMIIB/zCCAaWgAwIBAgIUCRvMFY20kEA6bHCUqdo+PL6GqO0wCgYIKoZIzj0EAwIw\nJDEQMA4GA1UEChMHYmNkY2RldjEQMA4GA1UEAxMHYmNkY2RldjAeFw0xODA3MTAw\nNDIxMDBaFw0xOTA3MTAwNDIxMDBaMBsxGTAXBgNVBAMTEGJjZGNkZXYxb3JkZXJl\ncjAwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAAT5mEjbgQoAr+j5wVdIfIhT6Pov\n57dovycyPUDeG3JgAAXF3dQ1d1K80ObZuyltcXYDYdEj8TR0u01ueYfz9Thko4G9\nMIG6MA4GA1UdDwEB/wQEAwIHgDAMBgNVHRMBAf8EAjAAMB0GA1UdDgQWBBRsnFha\n5v6lnsnI4RbZ5O18zgofxTAfBgNVHSMEGDAWgBQyu615/Fx2z9UcR/nBgGw/0Q5g\nRTBaBgNVHREEUzBRgglsb2NhbGhvc3SCRDdENUJBQUUwMEUxMjRGN0NBMkZBODgy\nMjdCQzMwODE4LW1nbXQuYmxvY2tjaGFpbi5vY3Aub3JhY2xlY2xvdWQuY29tMAoG\nCCqGSM49BAMCA0gAMEUCIQDWHhhmvx7KS4LvwPDczr3wF8/EYPKWKgwYn1G1/kIE\niAIgfHPWZHSZwoWcvocTzeYARXvflH5HQDr92DiVlpPY1Vk=\n-----END -----\n"
// 						},
// 						"nonce": {
// 							"type": "Buffer",
// 							"data": [
// 								8,
// 								40
// 							]
// 						}
// 					},
// 					"signature": {
// 						"type": "Buffer",
// 						"data": [
// 							48,
// 							47
// 						]
// 					}
// 				}]
// 			},
// 			{
// 				"value": {
// 					"index": {
// 						"low": 0,
// 						"high": 0,
// 						"unsigned": true
// 					}
// 				},
// 				"signatures": [{
// 					"signature_header": {
// 						"creator": {
// 							"Mspid": "bcdcdev",
// 							"IdBytes": "-----BEGIN -----\nMIIB/zCCAaWgAwIBAgIUCRvMFY20kEA6bHCUqdo+PL6GqO0wCgYIKoZIzj0EAwIw\nJDEQMA4GA1UEChMHYmNkY2RldjEQMA4GA1UEAxMHYmNkY2RldjAeFw0xODA3MTAw\nNDIxMDBaFw0xOTA3MTAwNDIxMDBaMBsxGTAXBgNVBAMTEGJjZGNkZXYxb3JkZXJl\ncjAwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAAT5mEjbgQoAr+j5wVdIfIhT6Pov\n57dovycyPUDeG3JgAAXF3dQ1d1K80ObZuyltcXYDYdEj8TR0u01ueYfz9Thko4G9\nMIG6MA4GA1UdDwEB/wQEAwIHgDAMBgNVHRMBAf8EAjAAMB0GA1UdDgQWBBRsnFha\n5v6lnsnI4RbZ5O18zgofxTAfBgNVHSMEGDAWgBQyu615/Fx2z9UcR/nBgGw/0Q5g\nRTBaBgNVHREEUzBRgglsb2NhbGhvc3SCRDdENUJBQUUwMEUxMjRGN0NBMkZBODgy\nMjdCQzMwODE4LW1nbXQuYmxvY2tjaGFpbi5vY3Aub3JhY2xlY2xvdWQuY29tMAoG\nCCqGSM49BAMCA0gAMEUCIQDWHhhmvx7KS4LvwPDczr3wF8/EYPKWKgwYn1G1/kIE\niAIgfHPWZHSZwoWcvocTzeYARXvflH5HQDr92DiVlpPY1Vk=\n-----END -----\n"
// 						},
// 						"nonce": {
// 							"type": "Buffer",
// 							"data": [
// 								124,
// 								181
// 							]
// 						}
// 					},
// 					"signature": {
// 						"type": "Buffer",
// 						"data": [
// 							48,
// 							125
// 						]
// 					}
// 				}]
// 			},
// 			[
// 				0
// 			]
// 		]
// 	}
// }