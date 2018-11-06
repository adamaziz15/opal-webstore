@App.controller 'OrganizationController', ($log, $filter, $state, $stateParams, $uibModal, $q, toastr, MnoeAdminConfig, MnoeOrganizations, MnoeCurrentUser, MnoAppsInstances, MnoeTenant, UserRoles) ->
  'ngInject'
  vm = this

  vm.orgId = $stateParams.orgId
  vm.users = {}
  vm.hasDisconnectedApps = false
  vm.status = {}
  vm.isLoading = true

  MnoeCurrentUser.getUser().then(
    (response) ->
      vm.isSupportAgent = UserRoles.isSupportAgent(response)
      vm.supportDisabledClass = UserRoles.supportDisabledClass(response)
  )

  vm.editCurrency = () ->
    vm.editmode = true

  vm.availableBillingCurrencies = MnoeAdminConfig.availableBillingCurrencies()
  vm.managementAndProvisioningEnabled = MnoeAdminConfig.isProvisioningEnabled() && MnoeAdminConfig.isAppManagementEnabled()

  # Display user creation modal
  vm.users.createUserModal = ->
    modalInstance = $uibModal.open(
      templateUrl: 'app/views/organization/create-user-modal/create-user.html'
      controller: 'CreateUserController'
      controllerAs: 'vm'
      resolve:
        organization: vm.organization
    )
    modalInstance.result.then(
      (user) ->
        # Push user to the current list of users
        vm.organization.members.push(user)
    )

  initOrganization = ->
    # Get the organization
    MnoeOrganizations.get($stateParams.orgId).then(
      (response) ->
        vm.organization = response.data.plain()
        vm.organization.invoices = $filter('orderBy')(vm.organization.invoices, '-started_at')
        vm.updateStatus()
    ).catch(->
      $state.go('dashboard.home')
      $q.reject()
    ).finally(-> vm.isLoading = false)

  initOrganization()

  MnoeTenant.get().then(
    (response) ->
      vm.orgCreditManagement = response.data.organization_credit_management
  )

  vm.freezeOrganization = ->
    MnoeOrganizations.freeze(vm.organization).then(
      (response) ->
        toastr.success("mnoe_admin_panel.dashboard.organization.update_organization.toastr_success", {extraData: { name: vm.organization.name}})
        angular.copy(response.data.plain().organization, vm.organization)
      (error) ->
        toastr.error("mnoe_admin_panel.dashboard.organization.update_organization.toastr_error")
        $log.error("An error occurred:", error)
    )

  vm.unfreezeOrganization = ->
    MnoeOrganizations.unfreeze(vm.organization).then(
      (response) ->
        toastr.success("mnoe_admin_panel.dashboard.organization.update_organization.toastr_success", {extraData: { name: vm.organization.name}})
        angular.copy(response.data.plain().organization, vm.organization)
      (error) ->
        toastr.error("mnoe_admin_panel.dashboard.organization.update_organization.toastr_error")
        $log.error("An error occurred:", error)
    )

  vm.updateStatus = ->
    vm.status = {}
    _.map(vm.organization.active_apps,
      (app) ->
        vm.status[app.nid] = MnoAppsInstances.isConnected(app)
    )
    # Check the number of apps not connected (number of status equals to false)
    vm.hasDisconnectedApps = false of _.countBy(vm.status)

  vm.updateOrganization = ->
    vm.editmode = false
    vm.isSaving = true
    MnoeOrganizations.update(vm.organization).then(
      (response) ->
        toastr.success("mnoe_admin_panel.dashboard.organization.update_organization.toastr_success", {extraData: { name: vm.organization.name}})
        vm.organization = response.data.organization
      (error) ->
        toastr.error("mnoe_admin_panel.dashboard.organization.update_organization.toastr_error")
        $log.error("An error occurred while updating staff:", error)
    ).finally(-> vm.isSaving = false)

  vm.resetBillingCurrency = ->
    vm.organization.billing_currency = null
    vm.updateOrganization()

  vm.openSelectProductModal = () ->
    return if vm.isSupportAgent

    # Is an up to date account required to allow app management and is the account past due?
    paymentRequired = MnoeAdminConfig.isCurrentAccountRequired() && vm.organization.in_arrears
    # Are billing details required and are they present?
    detailsRequired = MnoeAdminConfig.areBillingDetailsRequired() && !vm.organization.credit_card.presence
    # Billing details need to be updated if payment or billing details are required
    # This is only enforced if payment is enabled (allows end user to add/update billing details)
    billingDetailsRequired = (paymentRequired || detailsRequired) && MnoeAdminConfig.isPaymentEnabled()

    modalInstance = $uibModal.open(
      component: 'mnoProductSelectorModal'
      backdrop: 'static'
      size: 'lg'
      resolve:
        dataFlag: -> 'organization-create-order'
        multiple: -> false
        activeInstances: -> vm.organization.active_apps
        billingDetailsRequired: -> billingDetailsRequired
    )

    modalInstance.result.then(
      (product) ->
        $state.go('dashboard.provisioning.order', {productId: product.id, orgId: vm.organization.id, editAction: 'provision'})
    )

  # Sync status info for an app instance
  vm.openAppInstanceInfoModal = (appInstance) ->
    modalInstance = $uibModal.open(
      templateUrl: 'app/views/organization/app-instance-info-modal/app-instance-info-modal.html'
      controller: 'AppInstanceInfoModal'
      controllerAs: 'vm'
      backdrop: 'static'
      size: 'md'
      resolve:
        appInstance: appInstance
        organization: vm.organization
    )

  vm.connectApps = () ->
    return if vm.isSupportAgent
    $state.go('dashboard.customers.connect-app',{orgId: vm.organization.id})

  # Remove app modal
  vm.openRemoveAppModal = (app, index) ->
    return if vm.isSupportAgent
    modalInstance = $uibModal.open(
      templateUrl: 'app/views/organization/remove-app-modal/remove-app-modal.html'
      controller: 'RemoveAppModalCtrl'
      controllerAs: 'vm'
      backdrop: 'static'
      windowClass: 'remove-app-modal'
      size: 'md'
      resolve:
        app: app
    )
    modalInstance.result.then(
      (result) ->
        # If the user decide to remove the app
        if result
          vm.organization.active_apps.splice(index, 1)
          vm.updateStatus()
    )

  vm.openTransactionModal = ->
    return if vm.isSupportAgent
    modalInstance = $uibModal.open(
      templateUrl: 'app/views/organization/add-transaction-modal/add-transaction-modal.html'
      controller: 'AddTransactionModalCtrl'
      controllerAs: 'vm'
      backdrop: 'static'
      windowClass: 'add-transaction-modal'
      size: 'md'
      resolve:
        organization: vm.organization
    )
    modalInstance.result.then(
      (result) ->
        vm.isLoading = true
        initOrganization()
    )

  return vm
