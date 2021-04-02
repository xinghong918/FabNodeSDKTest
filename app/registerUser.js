'use strict';
/*
* Copyright IBM Corp All Rights Reserved
*
* SPDX-License-Identifier: Apache-2.0
*/
/*
 * Register and Enroll a user
 */
var log4js = require('log4js');
var Fabric_Client = require('fabric-client');
var Fabric_CA_Client = require('fabric-ca-client');

var path = require('path');
var util = require('util');
var os = require('os');
var logger = log4js.getLogger('RegisterUser');
//logger.setLevel('DEBUG');
logger.level = 'DEBUG';

var getRegisteredUser = function (userName, mspid, ca_url, userAttrs) {
    //
    var client = new Fabric_Client();
    var fabric_ca_client = null;
    var admin_user = null;
    var member_user = null;
    var store_path = Fabric_Client.getConfigSetting('keyValueStore');
    logger.info(' Store path:' + store_path);
    // ABAC: user attribute
    var userAttrReq = [];
    if(userAttrs){
      for(var it in userAttrs){
        userAttrReq.push({name:it.name, optional:false});
      }
    }

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
        // be sure to change the http to https when the CA is running TLS enabled
        fabric_ca_client = new Fabric_CA_Client(ca_url, null, '', crypto_suite);

        // first check to see if the admin is already enrolled
        return client.getUserContext('admin', true);
    }).then((user_from_store) => {
        if (user_from_store && user_from_store.isEnrolled()) {
            logger.info('Successfully loaded admin from persistence');
            admin_user = user_from_store;
        } else {
            throw new Error('Failed to get admin.... run enrollAdmin.js');
        }

        // at this point we should have the admin user
        // first need to register the user with the CA server
        let identityReq = {enrollmentID: userName, affiliation: 'Org1MSP.dept', role: 'client'};
        if(userAttrs && userAttrs.length > 0){
            identityReq.attrs = userAttrs;
        }
        return fabric_ca_client.register(identityReq, admin_user);
    }).then((secret) => {
        // next we need to enroll the user with CA server
        logger.info('Successfully registered '+userName+' - secret:' + secret);
        let identityReq = {enrollmentID: userName, enrollmentSecret: secret};
        if(userAttrReq && userAttrReq.length > 0){
            identityReq.attr_reqs = userAttrReq;
        }
        return fabric_ca_client.enroll(identityReq);
    }).then((enrollment) => {
        logger.info('Successfully enrolled member user "'+userName+'" ');
        return client.createUser(
            {
                username: userName,
                mspid: mspid,
                cryptoContent: { privateKeyPEM: enrollment.key.toBytes(), signedCertPEM: enrollment.certificate }
            });
    }).then((user) => {
        member_user = user;

        return client.setUserContext(member_user);
    }).then(() => {
        logger.info(userName+' was successfully registered and enrolled and is ready to intreact with the fabric network');
        resolve();
    }).catch((err) => {
        logger.error('Failed to register: ' + err);
        if (err.toString().indexOf('Authorization') > -1) {
            logger.error('Authorization failures may be caused by having admin credentials from a previous CA instance.\n' +
                'Try again after deleting the contents of the store directory ' + store_path);
        }
        reject(err);
    });
});
};

exports.getRegisteredUser = getRegisteredUser;