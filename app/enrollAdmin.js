'use strict';
/*
* Copyright IBM Corp All Rights Reserved
*
* SPDX-License-Identifier: Apache-2.0
*/
/*
 * Enroll the admin user
 */
var log4js = require('log4js');
var Fabric_Client = require('fabric-client');
var Fabric_CA_Client = require('fabric-ca-client');

var path = require('path');
var util = require('util');
var os = require('os');
var fs = require('fs-extra');
var logger = log4js.getLogger('EnrollAdmin');
//logger.setLevel('DEBUG');
logger.level = 'DEBUG';

//
var getAdminUser = function (userName, mspid, ca_url, tlsPemFile) {
    var client = new Fabric_Client();
    var fabric_ca_client = null;
    var admin_user = null;
    var member_user = null;
    var store_path = Fabric_Client.getConfigSetting('keyValueStore');
    logger.info(' Store path:' + store_path);

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
            var tlsOptions = {
                trustedRoots: [],
                verify: false
            };

            if(tlsPemFile){
                let data = fs.readFileSync(path.join(Fabric_Client.getConfigSetting('keyValueStore'), tlsPemFile));
                tlsOptions.trustedRoots.push(data);
                tlsOptions.verify = true;
            }
            

            // be sure to change the http to https when the CA is running TLS enabled
            fabric_ca_client = new Fabric_CA_Client(ca_url, tlsOptions, '', crypto_suite);
            //    fabric_ca_client = new Fabric_CA_Client('https://localhost:7054', null /*defautl TLS opts*/, '' /* default CA */, crypto_suite);

            // first check to see if the admin is already enrolled
            return client.getUserContext(userName, true);
        }).then((user_from_store) => {
            if (user_from_store && user_from_store.isEnrolled()) {
                logger.info('Successfully loaded admin user "' + userName + '" from persistence');
                admin_user = user_from_store;
                return null;
            } else {
                // need to enroll it with CA server
                return fabric_ca_client.enroll({
                    enrollmentID: Fabric_Client.getConfigSetting('admins')[0].username,
                    enrollmentSecret: Fabric_Client.getConfigSetting('admins')[0].secret
                }).then((enrollment) => {
                    logger.info('Successfully enrolled admin user "' + userName + '"');
                    return client.createUser(
                        {
                            username: userName,
                            mspid: mspid,
                            cryptoContent: { privateKeyPEM: enrollment.key.toBytes(), signedCertPEM: enrollment.certificate }
                        });
                }).then((user) => {
                    admin_user = user;
                    return client.setUserContext(admin_user);
                }).catch((err) => {
                    logger.error('Failed to enroll and persist admin. Error: ' + err.stack ? err.stack : err);
                    throw new Error('Failed to enroll admin');
                });
            }
        }).then(() => {
            logger.info('Assigned the admin user to the fabric client ::' + admin_user.toString());
            resolve();
        }).catch((err) => {
            logger.error('Failed to enroll admin: ' + err);
            reject();
        });
    });
};

exports.getAdminUser = getAdminUser;