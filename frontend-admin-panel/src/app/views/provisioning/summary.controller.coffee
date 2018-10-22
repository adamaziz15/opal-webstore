@App.controller('ProvisioningSummaryCtrl', ($q, $scope, $stateParams, MnoeOrganizations, MnoeProvisioning, MnoeAdminConfig, ProvisioningHelper, MnoeBlueSky) ->
  vm = this

  orgPromise = MnoeOrganizations.get($stateParams.orgId)
  vm.subscription = MnoeProvisioning.getCachedSubscription()
  vm.selectedCurrency = MnoeProvisioning.getSelectedCurrency() || vm.subscription.currency
  vm.quoteBased = false
  vm.quoteFetched = false
  vm.dataLoading = true
  subPromise = if _.isEmpty(vm.subscription)
    MnoeProvisioning.initSubscription({productId: $stateParams.productId, orgId: $stateParams.orgId, subscriptionId: $stateParams.subscriptionId})
  else
    $q.resolve(vm.subscription)

  vm.pricedPlan = ProvisioningHelper.pricedPlan
  vm.orderTypeText = 'mnoe_admin_panel.dashboard.provisioning.subscriptions.' + $stateParams.editAction.toLowerCase()

  setSchemaReadOnlyData = ->
    vm.editor = MnoeBlueSky.getCachedBSEditor()
    vm.editorValues = vm.editor?.getValue()
    vm.dataLoading = false

  vm.isLoading = true
  $q.all({organization: orgPromise, subscription: subPromise}).then(
    (response) ->
      vm.orgCurrency = response.organization.data.billing_currency || MnoeAdminConfig.marketplaceCurrency()
      vm.subscription = response.subscription
      vm.nonSchemaAction = $stateParams.editAction in (vm.subscription.non_schema_actions || [])
      vm.singleBilling = vm.subscription.product.single_billing_enabled
      vm.billedLocally = vm.subscription.product.billed_locally
      vm.bsEditorEnabled = vm.subscription.product.js_editor_enabled && !vm.nonSchemaAction
      vm.quoteBased = vm.subscription.product_pricing?.quote_based || vm.bsEditorEnabled
      vm.quote = MnoeProvisioning.getCachedQuote() if vm.quoteBased
      vm.quoteFetched = true
      setSchemaReadOnlyData() if vm.bsEditorEnabled
  ).finally(-> vm.isLoading = false)

  vm.pricingText = () ->
    if !vm.singleBilling || vm.subscription.product.js_editor_enabled
      'mnoe_admin_panel.dashboard.provisioning.summary.pricing_info.single_billing_disabled'
    else if vm.billedLocally
      'mnoe_admin_panel.dashboard.provisioning.summary.pricing_info.billed_locally'
    else
      'mnoe_admin_panel.dashboard.provisioning.summary.pricing_info.externally_managed'

  # Delete the cached subscription.
  $scope.$on('$stateChangeStart', (event, toState) ->
    MnoeProvisioning.setSubscription({})
  )

  return
)
