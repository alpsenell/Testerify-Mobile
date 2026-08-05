// Personal-team (free Apple ID) signing rejects the aps-environment
// entitlement that expo-notifications adds; local notifications work without it.
const { withEntitlementsPlist } = require('expo/config-plugins')

module.exports = (config) =>
  withEntitlementsPlist(config, (c) => {
    delete c.modResults['aps-environment']
    return c
  })
