
#============================================
#
#============================================
angular.module 'mnoEnterpriseAngular'
  .directive('mnoProductQuote', (MnoeBlueSky) ->
    return {
      restrict: 'EA'
      templateUrl: 'app/components/mno-product-quote/mno-product-quote.html',
      scope: {
        quoteBased: '=',
        quote: '=',
        subscription: '='
      }

      controller: ($scope) ->
        $scope.bsEditorEnabled = $scope.subscription.product.js_editor_enabled
        $scope.quotedPrice = $scope.quote.totalListPrice
        $scope.quotedCurrency = $scope.quote.totalContractValue?.currency

        extractDisclaimerMsg = ->
          keys = $scope.quote.disclaimer?.split('.')
          return unless keys

          MnoeBlueSky.getSchemaTranslations().then(
            (response) ->
              trans = angular.copy(response.productTranslations)
              _.each keys, (key) ->
                return unless trans
                trans = trans[key]

              $scope.disclaimerMsg = trans
          )

        extractDisclaimerMsg()

        return
    }
)
