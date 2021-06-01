export FABRIC_CFG_PATH=$PWD
export CFG_BIN_PATH=/home/oracle/oracle_fabric/dockerfiles/oracle/console/console/sbin
export CHANNEL_NAME=samchannel
$CFG_BIN_PATH/configtxgen -profile ObcsChannelCreatProfile -channelID $CHANNEL_NAME -outputCreateChannelTx $FABRIC_CFG_PATH/channel.tx


# $CFG_BIN_PATH/configtxlator start
# curl -X POST --data-binary @channel.tx http://localhost:7059/protolator/decode/common.Envelope > channel.json


#Update Anchor peers, first
configtxgen -profile TwoOrgsChannel -outputAnchorPeersUpdate ./config/myfabric_anchors.tx -channelID xh -asOrg myfabric

