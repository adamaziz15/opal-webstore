
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

        $scope.extractDisclaimerMsg = ->
          keys = $scope.quote.disclaimer?.split('.')
          translations = MnoeBlueSky.getCachedTranslations()
          if keys.length == 1
            return translations[key]
          else
            trans = translations
            _.each keys, (key) ->
              trans = trans[key]
            trans

        return
    }
)
