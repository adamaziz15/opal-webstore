angular.module 'mnoEnterpriseAngular'
  .controller('AppManagementCtrl',
    ($q, $state, $scope, toastr, $stateParams, MnoeConfig, MnoeProductInstances, MnoeProvisioning,
      MnoeOrganizations, MnoeCurrentUser, MnoeMarketplace, PRICING_TYPES, ProvisioningHelper,
      AppSettingsHelper, AppManagementHelper) ->

        vm = @
        vm.isLoading = true
        vm.isOrderHistoryLoading = true
        vm.isCurrentSubscriptionLoading = true
        vm.isSubChanged = true
        vm.recentSubscription = AppManagementHelper.recentSubscription
        vm.editSubscription = ProvisioningHelper.editSubscription
        vm.showEditAction = ProvisioningHelper.showEditAction
        vm.goToSubscription = ProvisioningHelper.goToSubscription

        vm.dataSharingMessage = ->
          if AppManagementHelper.isProductConnected(vm.product)
            'mno_enterprise.templates.dashboard.app_management.manage.tab.connection_status.sync_in_progress'
          else
            'mno_enterprise.templates.dashboard.app_management.manage.tab.connection_status.never_sync'

        # Return true if the plan has a dollar value
        vm.pricedPlan = (plan) ->
          ProvisioningHelper.pricedPlan(plan)

        vm.toggleSubscriptionNext = (pricingId) ->
          vm.changeAction && vm.isSubChanged = vm.currentPlanId == pricingId

        vm.nextSubscription = ->
          urlParams =
            subscriptionId: vm.currentSubscription.id
            productId: vm.product.id
            editAction: 'change'
          MnoeProvisioning.setSubscription(vm.currentSubscription)
          if vm.currentSubscription.product.custom_schema?
            $state.go('home.provisioning.additional_details', urlParams)
          else
            $state.go('home.provisioning.confirm', urlParams)

        # ********************** Flags *********************************
        vm.providesStatus = (product) ->
          product.data_sharing || product.subscription

        vm.selectPlan = (pricingPlan) ->
          vm.changeAction && vm.isSubChanged = vm.currentPlanId == pricingPlan.id
          vm.currentSubscription.product_pricing = pricingPlan
          vm.currentSubscription.max_licenses ||= 1 if vm.currentSubscription.product_pricing.license_based

        vm.dataSharingEnabled = ->
          MnoeConfig.isDataSharingEnabled() && vm.product.data_sharing && vm.isAdmin

        vm.manageSubScriptionEnabled = ->
          vm.isAdmin

        vm.orderHistoryEnabled = ->
          vm.isAdmin

        vm.isAddOnSettingShown = ->
          AppSettingsHelper.isAddOnSettingShown(vm.product)

        # ********************** Data Load *********************************
        vm.setUserRole = ->
          vm.isAdmin = MnoeOrganizations.role.atLeastAdmin()

        setupSubscription = (subscription) ->
          vm.currentSubscription = subscription
          vm.orgCurrency = vm.organization?.currency || MnoeConfig.marketplaceCurrency()

          MnoeMarketplace.getProduct(vm.currentSubscription.product.id).then((response) ->
            vm.currentSubscription.product = response
            MnoeMarketplace.fetchCustomSchema(response.id, { editAction: $stateParams.editAction }).then((response) ->
              # Some products have custom schemas, whereas others do not.
              vm.currentSubscription.product.custom_schema = response
            )

            vm.singleBilling = response.single_billing_enabled
            vm.billedLocally = response.billed_locally

            # Filters the pricing plans not containing current currency
            vm.currentSubscription.product.pricing_plans =  ProvisioningHelper.plansForCurrency(vm.currentSubscription.product.pricing_plans, vm.orgCurrency)
            vm.currentPlanId = vm.currentSubscription.product_pricing_id
            )
          vm.isCurrentSubscriptionLoading = false

        setupChangeAction = ->
          vm.changeAction = 'change' in vm.currentSubscription.available_actions

        vm.loadCurrentSubScription = (subscriptions) ->
          product_subscriptions = _.filter(subscriptions, (sub) -> sub.product_instance_id == vm.product.id)
          if product_subscriptions
            fulfilled_subs = _.filter(product_subscriptions, { status: 'fulfilled'} )
            subscription = if fulfilled_subs.length > 0
              vm.recentSubscription(fulfilled_subs)
            else
              vm.recentSubscription(product_subscriptions)

          if subscription
            setupSubscription(subscription)
            setupChangeAction()
          else
            vm.isCurrentSubscriptionLoading = false

        vm.loadOrderHistory = ->
          if vm.currentSubscription
            MnoeProvisioning.getSubscriptionEvents(vm.currentSubscription.id, 'created_at.desc').then(
              (response) ->
                vm.subscriptionsHistory = response
            ).finally( -> vm.isOrderHistoryLoading = false)
          else
            vm.isOrderHistoryLoading = false

        vm.addOnSettingLauch = ->
          AppSettingsHelper.addOnSettingLauch(vm.product)

        # ********************** Initialize *********************************
        vm.init = ->
          vm.setUserRole()

          productPromise = MnoeProductInstances.getProductInstances()
          subPromise = if vm.isAdmin then MnoeProvisioning.getSubscriptions() else null
          userPromise = MnoeCurrentUser.get()

          $q.all({products: productPromise, subscriptions: subPromise, currentUser: userPromise}).then(
            (response) ->
              vm.product = _.find(response.products, { id: $stateParams.appId })
              unless vm.product
                toastr.error('mno_enterprise.templates.dashboard.app_management.unavailable')
                $state.go('home.apps-management')
                return

              vm.organization = _.find(response.currentUser.organizations, {id: MnoeOrganizations.selectedId})

              # Manage subscription flow
              vm.loadCurrentSubScription(response.subscriptions)

              # Order Histroy flow
              vm.loadOrderHistory() if vm.isAdmin

              # Sync Status flow
              vm.product = AppManagementHelper.setProductSyncStatuses([vm.product])[0]
          ).finally(
            ->
              vm.isLoading = false
            )

        #====================================
        # Post-Initialization
        #====================================
        $scope.$watch MnoeOrganizations.getSelectedId, (val) ->
          if val?
            vm.isLoading = true
            vm.init()

        return
  )
