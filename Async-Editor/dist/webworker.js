(function() {



var utilClass = (function() {

  return {
    $IsRendering: function(Dictionary) {
      return Dictionary.display === "block" ? true : false;
    },
    $sortByPropertyOrder: function(object) {
      return Object.keys(object).sort(function(a, b) {
        var ordera = object[a].propertyOrder;
        var orderb = object[b].propertyOrder;
        if (typeof ordera !== "number") ordera = 1000;
        if (typeof orderb !== "number") orderb = 1000;

        return ordera - orderb;
      });
    },
    $isReadOnlyPostBuild: function(Dictionary) {
      var isReadOnly = Dictionary.readOnly ? "disabled" : "";

      if (self.disableToggle[Dictionary.id]) {
        var metaData = self.disableToggle[Dictionary.id];
        isReadOnly = metaData.isReadOnly ? "disabled" : "";
      }

      return isReadOnly;
    },
    $checkNoValidationFields: function(Dictionary) {
      if (Dictionary.enum && Dictionary.enum.length && Dictionary.enum[0] !== "") {
        Dictionary.noValidation = true;
        return false;
      }
      return true;
    },
    $checkrequiredFieldPostBuild: function(Dictionary) {
      if (!this.$checkNoValidationFields(Dictionary))
        return false;

      if (self.requireToggle[Dictionary.id]) {
        var metaData = self.requireToggle[Dictionary.id];
        Dictionary.requiredToggle = metaData.requiredToggle;
        return metaData.isRequired;
      }

      return Dictionary.isRequired;
    },
    $checkRequiredField: function(required, key, Dictionary) {
      if (!required)
        return false;

      if (typeof required === "boolean")
        return required;

      if (!this.$checkNoValidationFields(Dictionary))
        return false;

      return required.indexOf(key) !== -1 ? true : false;
    },
    $addError: function(Dictionary) {
      if (Dictionary.isRequired && Dictionary.type !== "object" && Dictionary.type !== "array") {
        if (Dictionary.requiredToggle && Dictionary.display === "block" && !Dictionary.isValid)
          self.errors.push(Dictionary.path);
        else {
          if ((Dictionary.key == "startDate" || Dictionary.key == "endDate")) {
            if (Dictionary.display == "block" && !Dictionary.isValid)
              self.errors.push(Dictionary.path);
          } else if (!Dictionary.requiredToggle && !Dictionary.isValid) {
            if (self.multipleDependency) {
              // before pushing to errors checking if an element is not under a dependency
              var parentPath = Dictionary.path.substr(0, Dictionary.path.lastIndexOf("."))
              var parentDictionary = self.Dictionary[parentPath];

              if (parentDictionary.display === "block" && Dictionary.display === "block")
                self.errors.push(Dictionary.path);
            } else
              self.errors.push(Dictionary.path);
          }
        }
      }
    },
    $Inheritance: function(ParentClass, ChildClass) {
      ParentClass.prototype = Object.create(ChildClass.prototype);
      ParentClass.prototype.constructor = ParentClass;
    },
    $isHidden: function(Schema) {
      var isHidden;
      if (!self.Dependencies[Schema.id])
        isHidden = Schema && Schema.options && (Schema.options.hidden || Schema.options.hide_display)
      else {
        if (self.Dependencies[Schema.id] && self.Dependencies[Schema.id].length) {
          isHidden = false;
        } else {
          isHidden = true;
        }
      }

      if (!self.multipleDependency) {
        if (self.hideDependency[Schema.dataID] && self.hideDependency[Schema.dataID].length)
          isHidden = true;
      }

      return isHidden ? 'none' : 'block';
    },
    $createPathAttribute: function(path) {
      var keys = path.split(".").splice(1);
      var str = "root";

      keys.forEach(function(item) {
        str = str + "[" + item + "]";
      });

      return str;
    },
    $TestDependency: function(currentDictionary, dependency) {
      var valueMatched;

      if (dependency.pattern) {
        valueMatched = testByPattern();
      } else {
        valueMatched = testByValue();
      }

      return valueMatched;

      function isRegExMatch(pattern, value) {
        return new RegExp(pattern).test(value);
      }

      function testByPattern() {
        var valueMatched;

        if (dependency.pattern.length && dependency.pattern instanceof Array) {
          for (var i = 0; i < dependency.pattern.length; i++) {
            if (!isRegExMatch(dependency.pattern[i], currentDictionary.value)) {
              valueMatched = false;
              break;
            } else
              valueMatched = true;
          }
        } else
          valueMatched = isRegExMatch(dependency.pattern, currentDictionary.value);

        return valueMatched;
      }

      function testByValue() {
        var valueToCheck = dependency.value || '',
          valuesToCheck = dependency.values || [];

        return (valueToCheck || valueToCheck === "") && currentDictionary.value === valueToCheck || (valuesToCheck && valuesToCheck.indexOf(currentDictionary.value) != -1)
      }
    },
    $setDependenciesAttribute: function(Schema) {
      var dependencies = Schema.options && Schema.options.dependencies || [];

      if (!dependencies || (dependencies && !dependencies.length))
        return "";

      dependencies.forEach(function(dependency) {
        var dependencyAttr = dependency.depId || dependency.id;

        var show = this.$TestDependency(Schema, dependency);

        if (!self.Dependencies[dependencyAttr])
          self.Dependencies[dependencyAttr] = [];

        // for mo type forms where and element can be hidden via two different include
        // works when multipleDependency is false
        if (!self.hideDependency[dependencyAttr] && !self.multipleDependency)
          self.hideDependency[dependencyAttr] = [];


        if (show || dependency.show) {
          // for multipleDependency element
          if (self.Dependencies[dependencyAttr].indexOf(Schema.path) === -1)
            self.Dependencies[dependencyAttr].push(Schema.path);
        } else if (!dependency.show) {
          if (self.Dependencies[dependencyAttr] && self.Dependencies[dependencyAttr].indexOf(Schema.path) !== -1)
            self.Dependencies[dependencyAttr].splice(self.Dependencies[dependencyAttr].indexOf(Schema.path), 1);

          if (!self.multipleDependency) {
            if (self.hideDependency[dependencyAttr].indexOf(Schema.path) === -1) {
              self.hideDependency[dependencyAttr].push(Schema.path);
            }
          }
        }

        this.$requiredValidation(dependency, show);
        this.$disabledValidation(dependency, show);
      }.bind(this));

      return JSON.stringify(dependencies);
    },
    $requiredValidation: function(dependency, valueMatched) {
      var dependencyAttr = dependency.depId || dependency.id;

      if (dependency.requiredToggle && !valueMatched) {
        dependency.isRequired = false;
        self.requireToggle[dependencyAttr] = JSON.parse(JSON.stringify(dependency));
      } else if (dependency.requiredToggle && valueMatched) {
        dependency.isRequired = true;
        self.requireToggle[dependencyAttr] = JSON.parse(JSON.stringify(dependency));
      }
    },
    $disabledValidation: function(dependency, valueMatched) {
      var dependencyAttr = dependency.depId || dependency.id;

      if (dependency.disableToggle && !valueMatched) {
        dependency.isReadOnly = true;
      } else if (dependency.disableToggle && valueMatched) {
        dependency.isReadOnly = false;
      }

      if (dependency.disableToggle !== undefined) {
        self.disableToggle[dependencyAttr] = JSON.parse(JSON.stringify(dependency));
      }
    },
    $getErrorMessages: function(errormsg, value) {
      if (!errormsg)
        return "";

      var errormsg = translation.translateErrors(errormsg);
      return errormsg.replace("{{0}}", value);
    },
    $getValueFromKey: function(path, object, seperator) {
      var paths = path.split(seperator);

      paths.forEach(function(key) {
        if (object)
          object = object[key];
      });

      return object;
    },
    $getTranslateErrors: function(patternMsg) {
      if (patternMsg)
        return this.translateErrors(patternMsg);
      if (this.Dictionary.options && this.Dictionary.options.patternMsg)
        return this.translateErrors(this.Dictionary.options.patternMsg)
      else
      if (this.Dictionary.customErrorCode)
        return this.translateErrors(this.Dictionary.customErrorCode)
      else
        return this.translateErrors('error_pattern');

    },
    $getDescriptionStyle: function(Dictionary) {
      var width = Dictionary.format === "date-time" ? 55 : 60;
      return Dictionary.type === "object" || Dictionary.type === "array" ?
        'margin: 0;border: 1px solid #e3e3e3;padding:0 8px;border-bottom:none;' :
        "width:" + width + "%;float: right;margin-bottom: 0px;";
    },
    $sanitize: function(value, numberFormaters) {
      value = value + "";

      //remove all characters
      var decimal_sep = numberFormaters.DECIMAL_SEP || '.';
      var group_sep = numberFormaters.GROUP_SEP || ',';
      var reg = new RegExp('[^0-9 | ^' + decimal_sep + group_sep + ']', 'g');
      value = value.replace(reg, '');

      // we are using a diferent decimal separator diferent to dot(.)
      if (decimal_sep !== '.') {
        //if value by user contains this decimal separator, we change to dot
        if (value.match('^[0-9]*[' + decimal_sep + '][0-9]+$') !== null) {
          value = value.replace(decimal_sep, '.');
        }

        var tmpValue = value;
        tmpValue = tmpValue.split(".");
        switch (tmpValue.length) {
          case 2:
            tmpValue[0] = tmpValue[0].replace(',', group_sep);
            tmpValue[1] = tmpValue[1].replace(',', group_sep);
            tmpValue = tmpValue.join(decimal_sep);
            break;
          case 1:
            tmpValue = tmpValue[0].replace(',', group_sep);
            break;
          default:
            tmpValue = value;
            break;
        }

        value = tmpValue;
      }

      return value;
    },
    $HandleNumberFields: function(value, numberFormaters) {
      value = value + "";
      if (numberFormaters.DECIMAL_SEP !== ".") {
        return value.replace(numberFormaters.DECIMAL_SEP, '.');
      }

      return value;
    }
  }

})();

 var ValidationsClass = (function() {

   /**
    * Validation for number fields
    */

   function NumberValidation() {}
   NumberValidation.prototype.$NumberTypeValidation = function() {

     var value = utilClass.$HandleNumberFields(this.Dictionary.value, self.numberFormaters);

     var display = this.Dictionary.hideValidationMssg ? "none" :
       !isNaN(value) ? "none" : "inline";

     var isValid = isNaN(value) ? false : true;

     // doing this because for multi language need to change "." to "," so that html can show them
     if (isValid)
       this.Dictionary.value = utilClass.$sanitize(this.Dictionary.value, self.numberFormaters);

     return {
       errormsg: this.translateErrors("error_invalid_number", "number"),
       type: this.Dictionary.type,
       isValid: isValid,
       display: display
     }
   }

   NumberValidation.prototype.$MaxLength = function() {
     var display = this.Dictionary.hideValidationMssg ? "none" :
       !(this.Dictionary.value.length > this.Dictionary.maxLength) ? "none" : "inline";

     return {
       errormsg: this.translateErrors("error_maxLength", this.Dictionary.maxLength),
       type: 'maxLength',
       maxLength: this.Dictionary.maxLength,
       path: this.Dictionary.path,
       isValid: !(this.Dictionary.value.length > this.Dictionary.maxLength),
       display: display
     };
   }

   NumberValidation.prototype.$MinLength = function() {
     var display = this.Dictionary.hideValidationMssg ? "none" :
       !(this.Dictionary.value.length < this.Dictionary.minLength) ? "none" : "inline";

     return {
       errormsg: this.translateErrors("error_minLength", this.Dictionary.minLength),
       type: 'minLength',
       minLength: this.Dictionary.minLength,
       path: this.Dictionary.path,
       isValid: !(this.Dictionary.value.length < this.Dictionary.minLength),
       display: display
     };
   }

   NumberValidation.prototype.exclusiveMinimumValidation = function() {
     var value = parseFloat(utilClass.$HandleNumberFields(this.Dictionary.value, self.numberFormaters));

     var display = this.Dictionary.hideValidationMssg ? "none" :
       value > this.Dictionary.minimum ? "none" : "inline";

     return {
       errormsg: this.translateErrors('error_minimum_excl', this.Dictionary.minimum),
       type: "exclusiveMinimum",
       path: this.Dictionary.path,
       isValid: value > this.Dictionary.minimum,
       display: display
     }
   }

   NumberValidation.prototype.inclusiveMinimumValidation = function(minimum) {
     this.dictionary.value = this.schema.minimum;

     return {
       minimumValue: this.schema.minimum,
       errormsg: "error_minimum_incl"
     }
   }


   NumberValidation.prototype.$MaximumValidation = function(validation) {
     var value = parseFloat(utilClass.$HandleNumberFields(this.Dictionary.value, self.numberFormaters));

     var display = this.Dictionary.hideValidationMssg ? "none" :
       !(value > this.Dictionary.maximum) ? "none" : "inline";

     return {
       errormsg: this.translateErrors('error_maximum_incl', this.Dictionary.maximum),
       type: "maximum",
       path: this.Dictionary.path,
       isValid: !(value > this.Dictionary.maximum),
       display: display,
       maximumValue: this.Dictionary.maximum
     }
   }


   NumberValidation.prototype.$MinimumValidation = function(validation) {
     var value = parseFloat(utilClass.$HandleNumberFields(this.Dictionary.value, self.numberFormaters));

     if (validation) {

       switch (validation.type) {
         case "minimum":
           validation.isValid = value >= validation.value;
       }
       return validation;
     } else {
       var display = this.Dictionary.hideValidationMssg ? "none" :
         value >= this.Dictionary.minimum ? "none" : "inline";

       if (this.Dictionary.exclusiveMinimum)
         return this.exclusiveMinimumValidation();
       else
         return {
           errormsg: this.translateErrors('error_minimum_incl', this.Dictionary.minimum),
           type: "minimum",
           path: this.Dictionary.path,
           isValid: value >= this.Dictionary.minimum,
           minimumValue: this.Dictionary.minimum,
           display: display
         }
     }
   }

   NumberValidation.prototype.$MultipleOf = function() {
     self.multipleOfCalculation.push(this.Dictionary.path);
     var value = parseFloat(utilClass.$HandleNumberFields(this.Dictionary.value, self.numberFormaters));

     return {
       type: "multipleOf",
       path: this.Dictionary.path,
       errormsg: this.translateErrors(this.Dictionary.customErrorCode, this.Dictionary.multipleOf),
       isValid: (value / this.Dictionary.multipleOf === Math.floor(value / this.Dictionary.multipleOf)),
       display: (value / this.Dictionary.multipleOf === Math.floor(value / this.Dictionary.multipleOf)) ? "none" : "inline"
     }
   };

   /**
    * Validation for string fields
    */

   function StringValidation(schema, dictionary) {
     NumberValidation.call(this);
   }

   utilClass.$Inheritance(StringValidation, NumberValidation);

   StringValidation.prototype.requiredValidation = function(validation) {
     var value;
     if (this.Dictionary.type !== "string" && this.Dictionary.type !== "boolean")
       value = parseFloat(utilClass.$HandleNumberFields(this.Dictionary.value, self.numberFormaters));
     else
       value = this.Dictionary.value;

     if (validation) {
       switch (validation.type) {
         case "equal":
           validation.isValid = value === validation.value;
           break;
       }
       return validation;
     } else {
       var isValid = checkedRequiredByType(this.Dictionary, value);

       var display = this.Dictionary.hideValidationMssg ? "none" :
         isValid ? "none" : "inline";


       return {
         errormsg: this.translateErrors("error_notset"),
         type: 'required',
         path: this.Dictionary.path,
         isValid: isValid,
         display: display
       };
     }
   }

   function checkedRequiredByType(Dictionary, value) {
     var isValid;

     if (Dictionary.requiredToggle) {
       if (!Dictionary.isRequired)
         isValid = true;
       else if (Dictionary.isRequired)
         isValid = getValid(Dictionary, value);
     } else {
       isValid = getValid(Dictionary, value);
     }
     return isValid;
   }


   function getValid(Dictionary, value) {

     // for sep
     if (Dictionary.minimum === 0 && !Dictionary.exclusiveMinimum) {
       return value ? true : false
     }

     // for azure
     if (Dictionary.type === "number" && Dictionary.type === "integer" && Dictionary.minimum !== undefined)
       return value ? true : false;
     else if (Dictionary.type === "boolean")
       return typeof value !== "undefined" ? true : false;
     else
       return value || value === 0 ? true : false;

   }

   StringValidation.prototype.patternValidation = function(pattern) {
     var pattern_ = pattern || this.Dictionary.pattern;
     var valid = new RegExp(pattern_).test(this.Dictionary.value) ? true : false;
     var display = this.Dictionary.hideValidationMssg ? "none" :
       new RegExp(pattern_).test(this.Dictionary.value) ? "none" : "inline";

     if (!this.Dictionary.isRequired && pattern) {
       display = "none";
       valid = true;
     }

     return {
       errormsg: this.getTranslateErrors(),
       pattern: pattern_,
       type: 'pattern',
       path: this.Dictionary.path,
       isValid: valid,
       display: display
     };
   }

   StringValidation.prototype.emailValidation = function() {
     var pattern = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
     var isValid = pattern.test(this.Dictionary.value);
     var display = this.Dictionary.hideValidationMssg ? "none" :
       isValid ? "none" : "inline";

     return {
       pattern: pattern,
       errormsg: this.translateErrors('error_email'),
       isValid: isValid,
       path: this.Dictionary.path,
       type: 'emailpattern',
       display: display
     }
   }


   /**
    * AnyOf Class
    */

   function AnyOf() {
     StringValidation.call(this)
   }

   utilClass.$Inheritance(AnyOf, StringValidation);


   AnyOf.prototype.$AnyOfParser = function() {
     var anyOfErrors = [];

     this.Dictionary.anyOf.forEach(function(item) {

       if (item.format && item.format.toUpperCase() === "EMAIL")
         anyOfErrors.push(this.emailValidation());
       else if (item.enum && item.enum.length)
         this.$HandleAnyOfEnum(item, anyOfErrors);
       else
         this.$AnyOfEnumParser(item, anyOfErrors);

     }.bind(this));

     this.$IsDictionaryValid(anyOfErrors);

     return {
       type: "anyOf",
       isValid: this.Dictionary.isValid,
       display: this.Dictionary.isValid ? "none" : "inline",
       conditions: anyOfErrors,
       path: this.Dictionary.path,
       errormsg: this.getTranslateErrors(this.Dictionary.customErrorCode || "error_anyOf")
     }
   }

   AnyOf.prototype.$IsDictionaryValid = function(anyOfErrors) {
     this.Dictionary.isValid = false;
     anyOfErrors.forEach(function(validation) {
       if (validation.isValid)
         this.Dictionary.isValid = true;
     }.bind(this));
   }

   AnyOf.prototype.$HandleAnyOfEnum = function(item, anyOfErrors) {
     item.enum.forEach(function(childItems) {
       this.$AnyOfEnumParser(childItems, anyOfErrors);
     }.bind(this));
   }

   AnyOf.prototype.$AnyOfEnumParser = function(childItems, anyOfErrors) {

     if (childItems === "")
       anyOfErrors.push(this.requiredValidation({
         type: "equal",
         value: childItems
       }));
     else if (childItems.type === "null")
       anyOfErrors.push(this.requiredValidation({
         type: "nullCheck",
         value: childItems.value
       }));
     else if (childItems.pattern)
       anyOfErrors.push(this.patternValidation(childItems.pattern));
     else if (childItems.number)
       anyOfErrors.push(this.$MinimumValidation({
         type: "minimum",
         value: childItems.value
       }))

   }

   /**
    * External Validation URL Class
    */

   function ExternalValidationUrl() {
     AnyOf.call(this);
   }

   utilClass.$Inheritance(ExternalValidationUrl, AnyOf);

   ExternalValidationUrl.prototype.$GetExternalValidation = function() {
     return {
       type: 'external',
       path: this.Dictionary.path,
       isValid: true
     };
   }

   /**
    * Validation Class
    */

   function Validation(Dictionary) {
     this.Dictionary = Dictionary;
     this.translateErrors = utilClass.$getErrorMessages;
     this.getTranslateErrors = utilClass.$getTranslateErrors;
     ExternalValidationUrl.call(this);
   }

   utilClass.$Inheritance(Validation, ExternalValidationUrl);


   Validation.prototype.getValidation = function() {

     var validations = [];

     switch (this.Dictionary.type) {
       case 'string':
       case 'number':
       case 'integer':
       case 'boolean':
         if (this.Dictionary.type === "number" || this.Dictionary.type === "integer")
           validations.push(this.$NumberTypeValidation());

         if (this.Dictionary.isRequired || this.Dictionary.requiredToggle)
           validations.push(this.requiredValidation());

         if (this.Dictionary.pattern)
           validations.push(this.patternValidation());

         if (this.Dictionary.maxLength)
           validations.push(this.$MaxLength());

         if (this.Dictionary.minLength)
           validations.push(this.$MinLength());

         if (this.Dictionary.minimum !== undefined) {
           validations.push(this.$MinimumValidation());
         }

         if (this.Dictionary.format && this.Dictionary.format.toUpperCase() === "EMAIL")
           validations.push(this.emailValidation())

         if (this.Dictionary.anyOf && this.Dictionary.anyOf.length) {
           validations.push(this.$AnyOfParser());
         }

         if (this.Dictionary.externalValidation)
           validations.push(this.$GetExternalValidation());

         if (this.Dictionary.multipleOf)
           validations.push(this.$MultipleOf());

         if (this.Dictionary.maximum)
           validations.push(this.$MaximumValidation());

         break;

     }

     return validations;
   }

   return {
     initValidation: function(Dictionary) {
       // if (!Dictionary.isRequired && !Dictionary.requiredToggle && !Dictionary.anyOf && !Dictionary.pattern && !Dictionary.multipleOf)
       //   return;

       if (Dictionary.type == "object")
         return;

       if (Dictionary.enum && Dictionary.enum[0])
         return;

       var validation = new Validation(Dictionary);

       return validation.getValidation();
     },
     IsDictionaryValid: function(Dictionary) {
       if (!Dictionary.validations || (Dictionary.validations && !Dictionary.validations.length))
         return;

       Dictionary.isValid = true;

       Dictionary.validations.forEach(function(validation) {
         if (!validation.isValid)
           Dictionary.isValid = false;
       });
     }

   }
 })();

var translation = (function() {
    function translationsClass() {
        return {
            translateErrors: translateErrors,
            translateSchema: translateSchema,
        }

        function translateErrors(key) {
            return self.Translations.errorTranslations[key] || key;
        }

        function translateSchema(Schema) {
            var keysToTranslate = self.Translations.keysToTranslate;
            var that = this;

            keysToTranslate.forEach(function(item) {
                var KeyForTranslation;
                if (item.type === "string") {
                    if (item.path) {
                        KeyForTranslation = utilClass.$getValueFromKey(item.path, Schema, ".");
                    }
                    Schema[item.key] = $StringTranslation(item.key, KeyForTranslation || Schema[item.key]);
                }
                if (item.type === "array") {
                    var objectForTranslation = utilClass.$getValueFromKey(item.path, Schema, ".");
                    $ArrayTranslation(item.key, objectForTranslation);
                }
            })
        }

        function $StringTranslation(translationKey, keyToTranslate) {
            if(self.Translations.productSchemaTranlations[translationKey]) {
              return self.Translations.productSchemaTranlations[translationKey][keyToTranslate] || keyToTranslate;
            } else {
              return keyToTranslate;
            }
        }

        function $ArrayTranslation(translationKey, enum_array) {
            if (enum_array && enum_array.length) {
                enum_array.forEach(function(item, index) {
                    if(self.Translations.productSchemaTranlations[translationKey]) {
                      enum_array[index] = self.Translations.productSchemaTranlations[translationKey][item] || item
                    } else {
                      enum_array[index] = self.Translations.productSchemaTranlations[translationKey][item] || item
                    }
                })
            }
        }

    }

    return translationsClass();
})();
 var Getters = (function() {

   function Getters(prefix, key, schema, required, initialValue) {
     this.key = key,
       this.schema = schema,
       this.required = required,
       this.Definations = self.Definations,
       this.prefix = prefix,
       this.initialValue = initialValue;

     this.__CheckMultipleDependency__();
     this.__GetMetaData__();
     this.__GetDatesData__();
     this.__ApplyWrappping__();
   };

   Getters.prototype.__ApplyWrappping__ = function() {
     this.schema.wrapLevelClass = "";
     this.schema.wrapLevelWidth = "";
     if (self.wrapLevel && typeof self.wrapLevel === "object" && Object.keys(self.wrapLevel).length) {
       var wrapLevels = Object.keys(self.wrapLevel);
       var depth = this.schema.path.split(".").length;
       if (wrapLevels.indexOf(depth.toString()) !== -1) {
         this.schema.wrapLevelClass = "block-structure";
         this.schema.wrapLevelWidth = "width:" + self.wrapLevel[depth];
       }
     }
   }

   Getters.prototype.__CheckMultipleDependency__ = function() {

     if (this.prefix === "root")
       self.multipleDependency = this.schema.multipleDependency ? true : false;

   }

   Getters.prototype.__GetMetaData__ = function() {

     this.schema.path = this.prefix + this.key;
     this.schema.key = this.key;
     // for some schema title is not coming

     this.schema.title = this.schema.itemsIterator ?
       (this.schema.title + " " + (+this.key + 1)) :
       this.schema.title || this.key;

     this.__Set$Ref__();

     if (this.schema.items && this.schema.items.title)
       translation.translateSchema(this.schema.items);

     this.schema.isRequired = utilClass.$checkRequiredField(this.required, this.key, this.schema);

     if (this.schema.options && this.schema.options.externalValidation)
       this.schema.externalValidation = 'data-external-validation="true"';
     else
       this.schema.externalValidation = "";

     this.schema.descriptionStyle = utilClass.$getDescriptionStyle(this.schema);

     this.schema.format = this.schema.format || "text";

     this.schema.pathAttribute = utilClass.$createPathAttribute(this.schema.path);

     this.schema.rootWrapperClass = this.schema.path === "root" ? '' : 'col-md-12';

     var headingPadding = this.schema.itemsIterator ? "0px 15px" : "1px 15px";
     this.schema.headingStyle = self.heading === "true" ?
       "cursor: default;background-color: #91C3D7;margin: 0;color: white;padding:" + headingPadding + ";border-top-right-radius: 7px;border-top-left-radius: 7px;" :
       "cursor: default;color: #6a6e70;background-color: transparent;padding:" + headingPadding + ";margin: 0;";

     this.schema.wellWithScrollClass = this.schema.type === "array" ? 'well well-sm infinite-scroll-area' : 'well well-sm';

     this.schema.wellWithScrollStyle = this.schema.type === "array" ? 'padding-bottom: 0px; max-height: 400px; overflow-y: auto;' : 'padding-bottom:0px;width:100%;';

     this.schema.dataID = (this.schema.id || this.schema.key);

     this.schema.booleanFontWeigth = this.schema.type === "boolean" ? "font-weight: normal;" : "";

     this.schema.disableDatePicker = (this.schema.dataID === "endDate" ? 'disabled' : '');

     this.schema.value = this.__GetValue__();

     if (this.schema.type === "boolean")
       this.schema.checked = this.schema.value ? 'checked' : '';

     this.schema.dependenciesAttribute = utilClass.$setDependenciesAttribute(this.schema);

     translation.translateSchema(this.schema);
   }


   Getters.prototype.__Set$Ref__ = function() {
     if (this.schema.$ref) {
       var $ref = this.__Get$Ref__(this.Definations, this.schema.$ref);

       for (var key in $ref) {
         if (this.schema[key])
           continue;

         this.schema[key] = typeof $ref[key] === "object" ? JSON.parse(JSON.stringify($ref[key])) : $ref[key];
       }
     }
   }

   Getters.prototype.__Get$Ref__ = function(Definations, $ref) {
     var keys = $ref.split("/").slice(2);

     keys.forEach(function(item) {
       Definations = Definations[item];
     });

     if (Definations && Definations['$ref'])
       return this.__Get$Ref__(self.Definations, Definations.$ref);
     else
       return Definations;
   }

   Getters.prototype.__GetValue__ = function() {
     if (!this.schema.type)
       return null;

     if (!this.initialValue && this.schema.type !== "number" && this.schema.type !== "integer")
       this.schema.hideValidationMssg = true;

     if (this.schema.type !== "object" && this.schema.type !== "array" && this.initialValue !== undefined) {
       this.schema.initialValue = this.initialValue;
       return this.initialValue;
     }

     if (this.schema.default || this.schema.default === 0)
       return this.schema.default;

     if (this.schema.enum && this.schema.enum[0])
       return this.schema.enum[0];

     if (this.schema.type === "number" || this.schema.type === "integer")
       return 0;

     if (this.schema.type === "boolean")
       return this.schema.default;

     if (this.schema.type !== "object" && this.schema.type !== "array")
       return "";

     if (this.schema.type === "object")
       return this.initialValue || {};

     if (this.schema.type === "array") {
       self.count = this.initialValue && this.initialValue.length ? this.initialValue.length : 0;
       return this.initialValue || [];
     }

   }

   Getters.prototype.__GetDatesData__ = function() {
     if (this.schema.dataID === "startDate" && this.schema.options && this.schema.options.hidden)
       self.dateCalculations[this.schema.dataID] = this.schema.path;

     if (this.schema.dataID === "endDate" && this.schema.options && this.schema.options.hidden)
       self.dateCalculations[this.schema.dataID] = this.schema.path;

     if (this.schema.dataID === "contractLength" || this.schema.dataID === "contractTerm") {
       self.contractLength = this.schema.value && this.schema.value.toLowerCase();
     }

   }


   return Getters;

 })();

var HTMLParser = (function() {

  function HTMLElement() {}

  HTMLElement.prototype.$CreateLinkElements = function(Dictionary) {
    var linkHTML = "";
    var linkString = '<div style="clear: both;"><a target="_blank" href="{{href}}" style="display: block;">{{rel}}</a></div>'

    if (Dictionary.links && Dictionary.links.length && Dictionary.type !== "object" && Dictionary.type !== "array") {
      Dictionary.links.forEach(function(link) {
        linkHTML += this.__HTMLParser__(link, linkString);
      }.bind(this));
    }
    return linkHTML;
  }


  HTMLElement.prototype.$CreateHeadingTag = function(Dictionary) {
    var headingHTML = "";

    headingHTML += Dictionary.type === 'object' || Dictionary.type === 'array' ?
      this.$GetObjectHeading(Dictionary) : this.$GetStringHeading(Dictionary);

    return headingHTML;
  }

  HTMLElement.prototype.$GetStringHeading = function(Dictionary) {
    var stringHeading = ""
    stringHeading += this.__HTMLParser__(Dictionary, "<div class='form-group {{hasError}}' style='display: inline'>");
    stringHeading += this.__HTMLParser__(Dictionary, "<span class='control-label' style='font-size: 14px;font-weight: bold;color: #6a6e70;float:left;display: inline-block;width: 39%;word-wrap: break-word;{{booleanFontWeigth}}'>");
    stringHeading += this.__HTMLParser__(Dictionary, "{{title}}");
    stringHeading += this.$GetOptionalElement(Dictionary);
    stringHeading += this.$GetItemOperationalButton(Dictionary);
    stringHeading += this.$AddToolTip(Dictionary)
    stringHeading += "</span>";

    stringHeading += CreateFormElementsCallback.call(this, Dictionary);
    stringHeading += this.$AddDescription(Dictionary);
    stringHeading += this.$setErrorMessages(Dictionary);

    if (Dictionary.externalValidation)
      stringHeading += this.$createExternalValidationMessages(Dictionary);

    stringHeading += "</div>";
    return stringHeading;
  }

  HTMLElement.prototype.$createExternalValidationMessages = function(Dictionary) {
    return '<p class="help-block external"></p>';
  }

  HTMLElement.prototype.$setErrorMessages = function(Dictionary, id) {

    if (!Dictionary.validations)
      return "";

    var errormsg = '<p class="help-block errormsg" style="width: 60%; float: right; margin-top: 0px;">';

    Dictionary.validations.forEach(function(validation, index) {
      if (validation.errormsg)
        errormsg += this.__HTMLParser__(validation, "<span style='padding:0;color: inherit;display:{{display}}' id='{{type}}'>{{errormsg}}. </span>");
    }.bind(this));
    errormsg += '</p>';

    return errormsg;
  }

  HTMLElement.prototype.$GetOptionalElement = function(Dictionary) {
    var optionalString = "";

    if (Dictionary.isRequired)
      optionalString += '<span id="isoptional" style="color: red;margin-left: 6px;">*</span>';
    else if (!Dictionary.noValidation)
      optionalString += '<span id="isoptional" style="color:#aab2bd">' + utilClass.$getErrorMessages('optional') + '</span>';

    return optionalString;
  }

  HTMLElement.prototype.$GetObjectHeading = function(Dictionary) {
    var objectHeading = "";

    objectHeading += (this.__HTMLParser__(Dictionary, "<h3 title='{{title}}' class='modal-header' style='{{headingStyle}}white-space: nowrap;overflow: hidden;text-overflow: ellipsis;'>"));
    if (self.heading)
      objectHeading += this.$GetHeadingCollapseButton(Dictionary);
    objectHeading += "<span style='font-size: 18px;color:inherit;'>";
    objectHeading += this.__HTMLParser__(Dictionary, "{{title}}");
    objectHeading += "</span>";
    objectHeading += this.$GetItemOperationalButton(Dictionary);
    objectHeading += "</h3>";
    objectHeading += this.$AddDescription(Dictionary);

    return objectHeading;
  }

  HTMLElement.prototype.$GetItemOperationalButton = function(Dictionary) {
    if (!Dictionary.itemsIterator)
      return "";

    var btnDown = false,
      btnUp = false;

    if (self.count > parseInt(Dictionary.dataID) + 1)
      btnDown = true;

    if (parseInt(Dictionary.dataID))
      btnUp = true;

    var color = Dictionary.type === "object" || Dictionary.type === "object" ? "color:white;margin-right: 5px;" : "margin-right: 5px;";

    return this.$GetButtonElement(Dictionary, [{
      icon: "glyphicon-remove",
      title: "Delete " + Dictionary.title,
      event: self.events.delete,
      itemsPath: Dictionary.path,
      id: "deleteitem",
      style: "top:0;" + color + ";width: auto;padding:6px",
      iconColor: "style='" + color + "'"
    }, {
      icon: "glyphicon-arrow-down",
      title: "Move down",
      event: self.events.moveDown,
      id: "movedown",
      whichWay: "down",
      itemsPath: Dictionary.path,
      style: "height: 32px;top:0;color: white !important;width: auto;padding:6px;display:" + (btnDown ? "block" : "none"),
      iconColor: "style='" + color + "'"
    }, {
      icon: "glyphicon-arrow-up",
      title: "Move up",
      event: self.events.moveUp,
      id: "moveup",
      whichWay: "up",
      itemsPath: Dictionary.path,
      style: "height: 32px;top:0;color: white !important;width: auto;padding:6px;display:" + (btnUp ? "block" : "none"),
      iconColor: "style='" + color + "'"
    }]);
  }

  HTMLElement.prototype.$GetHeadingCollapseButton = function(Dictionary) {
    return this.$GetButtonElement(Dictionary, [{
      icon: "glyphicon-chevron-down",
      title: "Collapse",
      event: self.events.collapse,
      itemsPath: Dictionary.path,
      id: "collapse",
      style: "right: 0;top:0;color: white !important;width: auto;",
      iconColor: "style='color: white; margin-right: 5px;'",
      label: ""
    }]);
  }

  HTMLElement.prototype.$GetItemButtons = function(Dictionary) {
    return this.$GetButtonElement(Dictionary, [{
      icon: "glyphicon-plus",
      title: "Add " + Dictionary.items.title,
      label: Dictionary.items.title,
      event: self.events.add,
      itemsPath: Dictionary.path,
      id: "additem",
      style: "",
      iconColor: "style='margin-right: 5px;'"
    }, {
      icon: "glyphicon-remove",
      title: "Delete All " + Dictionary.items.title,
      label: "Delete All",
      event: self.events.deleteAll,
      itemsPath: Dictionary.path,
      id: "deleteall",
      style: Dictionary.value && Dictionary.value.length > 0 ? "" : "display:none",
      iconColor: "style='margin-right: 5px;'"
    }]);
  }

  HTMLElement.prototype.$CreateFormElements = function(Dictionary, createHeading) {
    var formHTML = "";

    if (!createHeading)
      return formHTML;

    formHTML += this.$CreateHeadingTag(Dictionary);
    formHTML += this.$CreateLinkElements(Dictionary);

    return formHTML;

  }

  function CreateFormElementsCallback(Dictionary) {
    if (Dictionary.type !== "object" && Dictionary.type !== "array") {
      switch (Dictionary.type) {
        case 'string':
        case 'number':
        case 'integer':
          if (Dictionary.enum)
            return this.$CreateSelectElement(Dictionary);
          else if (Dictionary.format === "date-time")
            return this.$CreateDatePicker(Dictionary);
          else
            return this.$CreateTextElement(Dictionary);
          break;
        case 'boolean':
          return this.$CreateCheckBoxes(Dictionary);
          break;
        default:
          return "";
      }
    } else
      return "";
  };

  HTMLElement.prototype.$CreateCheckBoxes = function(Dictionary) {
    var checkboxHTML = this.__HTMLParser__(Dictionary, "<input {{externalValidation}} data-origname='{{path}}' {{checked}} id='{{title}}' type='checkbox' name = '{{pathAttribute}}'  style='width: auto;display:inline-block;float: right' ");
    checkboxHTML += this.__HTMLParser__(self.events, "onchange='{{change}}' />");
    return checkboxHTML;
  }


  HTMLElement.prototype.$CreateDatePicker = function(Dictionary) {
    var dateTimeString = this.__HTMLParser__(Dictionary, "<button {{disableDatePicker}}");
    dateTimeString += this.__HTMLParser__(self.events, " onclick='{{datepicker}}' type='button' class='btn calendar-datepicker' ");
    dateTimeString += this.__HTMLParser__(Dictionary, "name='{{pathAttribute}}' style='float:right;width: 5%' >");
    dateTimeString += "<img src='data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4NCjwhLS0gR2VuZXJhdG9yOiBBZG9iZSBJbGx1c3RyYXRvciAxNi4wLjAsIFNWRyBFeHBvcnQgUGx1Zy1JbiAuIFNWRyBWZXJzaW9uOiA2LjAwIEJ1aWxkIDApICAtLT4NCjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+DQo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IkxheWVyXzEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4Ig0KCSB3aWR0aD0iMzEuOTk4cHgiIGhlaWdodD0iMzJweCIgdmlld0JveD0iMCAwIDMxLjk5OCAzMiIgZW5hYmxlLWJhY2tncm91bmQ9Im5ldyAwIDAgMzEuOTk4IDMyIiB4bWw6c3BhY2U9InByZXNlcnZlIj4NCjxwYXRoIGZpbGw9IiM1MDk3QkEiIGQ9Ik03NjkuMTc5LDI4OC41MjVsLTguNDE5LTguMjA3Yy0wLjg1Ny0wLjgzMi0yLjI2OC0xLjM3LTMuNTkzLTEuMzdjLTEuMDE3LDAtMS44NzIsMC4zMTMtMi40NzMsMC44OTcNCgljLTAuMjY3LDAuMjU4LTI2LjY3OSwyNS44MDMtMzQuMjY0LDMzLjMwM2MtMS40OTEsMS40NzgtMi41NTMsMy4zMjQtMy4wNjgsNS4zNDNsLTMuMDIxLDExLjc3MQ0KCWMtMC4zNTIsMS4xMTMtMC4wODMsMi4zNzMsMC43MzYsMy40NTVjMC44OTcsMS4xODYsMi4yODQsMS45MjQsMy42MTMsMS45MjRjMC4zNDksMCwwLjY5MS0wLjA1MSwxLjA5Mi0wLjE3Mg0KCWMwLDAsNy4zNS0yLjY2LDEyLjE4MS00LjQ2OWMyLjAyMi0wLjc1NiwzLjgyOC0xLjg5OCw1LjM2NC0zLjM5NmwzMS44NS0zMS4wMzVDNzcxLjQ1MywyOTQuMzUsNzcxLjQ1MywyOTAuNzQzLDc2OS4xNzksMjg4LjUyNXoNCgkgTTcxOC45MzgsMzMzLjA0MmMtMC41MDUsMC4xNTEtMS4yNzgtMC4yMzctMS43NC0wLjg1MWMtMC4zMTMtMC40MTItMC40MzktMC44NTItMC4zMTktMS4yNDFsMy4wMzctMTEuODM5DQoJYzAuMTM5LTAuNTM0LDAuMzQxLTEuMDQ1LDAuNTcyLTEuNTQ1bDcuNDYxLDMuODE2YzAuMjE3LDAuMTExLDAuMzkzLDAuMjgzLDAuNDk0LDAuNDY5bDMuMjgxLDYuNDQ5DQoJYy0wLjIzMSwwLjEwNC0wLjQ2MSwwLjIxNS0wLjcwMSwwLjMwNUM3MjYuMjI0LDMzMC40LDcxOC45MzYsMzMzLjA0LDcxOC45MzgsMzMzLjA0MnogTTczNS40NjcsMzI1Ljc5Mg0KCWMtMC40NTksMC40NDQtMC45NTUsMC44NC0xLjQ2OSwxLjIwOWwtMy4yMTMtNi4zMTNjLTAuMzY1LTAuNjc5LTAuOTI1LTEuMjIyLTEuNjE2LTEuNTc0bC03LjI1OS0zLjcxMw0KCWMwLjEzMy0wLjE1LDAuMjU0LTAuMzEsMC4zOTYtMC40NDdjNS4xOTItNS4xMzcsMTkuMjM0LTE4Ljc1MiwyNy42NC0yNi44OTFsMTIuMTE5LDExLjgxMUw3MzUuNDY3LDMyNS43OTJ6IE03NjcuMzE3LDI5NC43NTQNCglsLTMuMzkyLDMuMzAzbC0xMi4xMTUtMTEuODA1YzIuODItMi43Myw0LjY3Mi00LjUyMSw0Ljc0Mi00LjU5czAuMjczLTAuMTQ4LDAuNjEzLTAuMTQ4YzAuNjg0LDAsMS40MTgsMC4zMTQsMS43MzEsMC42MjENCglsOC40MTksOC4yMDNDNzY4LjU2NSwyOTEuNTU3LDc2OC41NjUsMjkzLjUzOCw3NjcuMzE3LDI5NC43NTR6Ii8+DQo8Zz4NCgk8cGF0aCBmaWxsPSIjNTA5N0JBIiBkPSJNNTAxLjQyMiw0NjEuMjY0Yy01LjM1NC01LjM1NC0xMi40NzEtOC4zMDMtMjAuMDQyLTguMzAzYy03LjU3MiwwLTE0LjY4OCwyLjk0Ny0yMC4wNDMsOC4zMDMNCgkJcy04LjMwNCwxMi40NzQtOC4zMDQsMjAuMDQzYzAsNy41NzIsMi45NDgsMTQuNjg5LDguMzA0LDIwLjA0M2M1LjM1NCw1LjM1NSwxMi40NzEsOC4zMDYsMjAuMDQzLDguMzA2DQoJCWM3LjU3MSwwLDE0LjY4OC0yLjk0OSwyMC4wNDItOC4zMDZjNS4zNTQtNS4zNTQsOC4zMDQtMTIuNDcxLDguMzA0LTIwLjA0M0M1MDkuNzI2LDQ3My43MzcsNTA2Ljc3Niw0NjYuNjIsNTAxLjQyMiw0NjEuMjY0eg0KCQkgTTUwMC4xNyw1MDAuMDk4Yy01LjAyLDUuMDIxLTExLjY5MSw3Ljc4NS0xOC43OSw3Ljc4NXMtMTMuNzcxLTIuNzY2LTE4Ljc5MS03Ljc4NWMtNS4wMi01LjAxOS03Ljc4NC0xMS42OTItNy43ODQtMTguNzkxDQoJCWMwLTcuMDk4LDIuNzY2LTEzLjc3LDcuNzg0LTE4Ljc5MWM1LjAyMS01LjAyLDExLjY5Mi03Ljc4MiwxOC43OTEtNy43ODJjNy4wOTgsMCwxMy43NzEsMi43NjQsMTguNzksNy43ODINCgkJYzUuMDIxLDUuMDIxLDcuNzg0LDExLjY5Myw3Ljc4NCwxOC43OTFDNTA3Ljk1NCw0ODguNDA1LDUwNS4xODksNDk1LjA3OSw1MDAuMTcsNTAwLjA5OHoiLz4NCgk8cGF0aCBmaWxsPSIjNTA5N0JBIiBkPSJNNDg4LjIwNyw0ODEuMTQ1bC04LjQzOC04LjQzNmMtMC4zNDYtMC4zNDYtMC45MDUtMC4zNDYtMS4yNTIsMHMtMC4zNDcsMC45MDYsMCwxLjI1Mmw3LjkzMSw3LjkzDQoJCWwtNy45MzEsNy45MzFjLTAuMzQ3LDAuMzQ2LTAuMzQ3LDAuOTA1LDAsMS4yNTRjMC4xNzQsMC4xNzIsMC4zOTksMC4yNiwwLjYyNiwwLjI2YzAuMjI4LDAsMC40NTMtMC4wODgsMC42MjYtMC4yNmw4LjQzOC04LjQzOA0KCQljMC4yMDQtMC4yMDMsMC4yNzMtMC40NzksMC4yMzYtMC43NDZDNDg4LjQ4LDQ4MS42MjUsNDg4LjQxMSw0ODEuMzQ4LDQ4OC4yMDcsNDgxLjE0NXoiLz4NCjwvZz4NCjxnPg0KCTxnPg0KCQk8cGF0aCBmaWxsPSIjNTA5N0JBIiBkPSJNMTEuOTk4LDE4aDJ2LTJoLTJWMTh6IE0xMS45OTgsMjIuMDAxaDJWMjBoLTJWMjIuMDAxeiBNMTEuOTk4LDI2aDJ2LTJoLTJWMjZ6IE01Ljk5OCwyNmgydi0yaC0yVjI2eg0KCQkJIE01Ljk5OCwyMi4wMDFoMlYyMGgtMlYyMi4wMDF6IE01Ljk5OCwxOGgydi0yaC0yVjE4eiBNMTgsMjIuMDAxaDEuOTk4VjIwSDE4VjIyLjAwMXogTTIzLjk5OCwyMi4wMDFoMlYyMGgtMlYyMi4wMDF6IE0yMy45OTgsMTgNCgkJCWgydi0yaC0yVjE4eiBNMTgsMjZoMS45OTh2LTJIMThWMjZ6IE0yOCw0aC0yLjE4N2MwLjExMS0wLjMxNCwwLjE4NS0wLjY0NywwLjE4NS0xYzAtMS42NTYtMS4zNDMtMy0zLTNjLTEuNjU2LDAtMywxLjM0NC0zLDMNCgkJCWMwLDAuMzUzLDAuMDcxLDAuNjg2LDAuMTg1LDFoLTguMzY4YzAuMTEyLTAuMzE0LDAuMTg0LTAuNjQ3LDAuMTg0LTFjMC0xLjY1Ni0xLjM0Mi0zLTIuOTk4LTNDNy4zNDIsMCw1Ljk5OCwxLjM0NCw1Ljk5OCwzDQoJCQljMCwwLjM1MywwLjA3MiwwLjY4NiwwLjE4NCwxSDMuOTk4QzEuNzg5LDQsMCw1Ljc5MSwwLDh2MjBjMCwyLjIwOSwxLjc4OSw0LDMuOTk4LDRIMjhjMi4yMDksMCwzLjk5OC0xLjc5MSwzLjk5OC00VjgNCgkJCUMzMS45OTgsNS43OTEsMzAuMjA5LDQsMjgsNHogTTIyLDNjMC0wLjU1MywwLjQ0Ni0xLDAuOTk4LTFjMC41NTMsMCwxLDAuNDQ3LDEsMXY0YzAsMC41NTMtMC40NDcsMS0xLDFDMjIuNDQ2LDgsMjIsNy41NTMsMjIsN1YzDQoJCQl6IE03Ljk5OCwzYzAtMC41NTMsMC40NDktMSwxLjAwMi0xYzAuNTUxLDAsMC45OTgsMC40NDcsMC45OTgsMXY0YzAsMC41NTMtMC40NDcsMS0wLjk5OCwxQzguNDQ3LDgsNy45OTgsNy41NTMsNy45OTgsN1Yzeg0KCQkJIE0yOS45OTgsMjZjMCwyLjIwOS0xLjc4OSw0LTQsNGgtMjBDMy43ODksMzAsMiwyOC4yMDgsMiwyNlYxNmMwLTIuMjA5LDEuNzg5LTQsMy45OTgtNGgyMGMyLjIxMSwwLDQsMS43OTEsNCw0VjI2eiBNMjMuOTk4LDI2aDINCgkJCXYtMmgtMlYyNnogTTE4LDE4aDEuOTk4di0ySDE4VjE4eiIvPg0KCTwvZz4NCjwvZz4NCjwvc3ZnPg0K' />"
    dateTimeString += "</button>";
    dateTimeString += this.__HTMLParser__(Dictionary, "<input {{externalValidation}}  data-origname='{{path}}' type='{{format}}' class='form-control' data-schemaformat='{{format}}'");
    dateTimeString += this.__HTMLParser__(Dictionary, "value='{{value}}' name='{{pathAttribute}}' style='width:55%;float: right;' disabled='disabled' ");
    dateTimeString += this.__HTMLParser__(self.events, "onchange='{{input}}' />");

    return dateTimeString;
  }

  HTMLElement.prototype.$CreateTextElement = function(Dictionary) {
    if (Dictionary.format === "textarea")
      return this.$CreateTextArea(Dictionary);
    else
      return this.$CreateTextBoxes(Dictionary);
  }


  HTMLElement.prototype.$CreateTextArea = function(Dictionary) {
    var textAreaHTML = this.__HTMLParser__(Dictionary, '<textarea {{externalValidation}} {{isReadOnly}} data-origname="{{path}}" class="form-control" data-schemaformat="textarea"');
    textAreaHTML += this.__HTMLParser__(Dictionary, 'name="{{pathAttribute}}" style="width: 60%;height:100px; float: right;z-index: auto; position: relative; line-height: 20px; font-size: 14px;"');
    textAreaHTML += this.__HTMLParser__(self.events, 'onchange="{{textarea}}">');
    textAreaHTML += this.__HTMLParser__(Dictionary, '{{value}}</textarea>');
    return textAreaHTML;
  }

  HTMLElement.prototype.$CreateTextBoxes = function(Dictionary) {
    var textBoxHTML = this.__HTMLParser__(Dictionary, "<input {{externalValidation}}  data-origname='{{path}}' {{isReadOnly}} type='{{format}}' value='{{value}}' class='form-control' name='{{pathAttribute}}'");
    textBoxHTML += this.__HTMLParser__(self.events, "style='width: 60%;float: right'  onchange='{{input}}'/>");
    return textBoxHTML;
  }

  HTMLElement.prototype.$CreateSelectElement = function(Dictionary) {
    var selectString = this.__HTMLParser__(Dictionary, "<select {{externalValidation}} data-origname='{{path}}' data-dependencies ='{{dependenciesAttribute}}' class='form-control' {{isReadOnly}} name='{{pathAttribute}}'");
    selectString += this.__HTMLParser__(self.events, "onchange='{{select}}' style='width: 60%;float: right'>");
    selectString += this.$CreateSelectOptions(Dictionary);
    selectString += "</select>";
    return selectString;
  }

  HTMLElement.prototype.$CreateSelectOptions = function(Dictionary) {
    var optionsString = "";
    var enums = Dictionary.enum,
      titles = Dictionary.options && Dictionary.options.enum_titles || [],
      defaultOption = Dictionary.default;

    enums.forEach(function(key, index) {
      optionsString += "<option  " + (key === (Dictionary.value || defaultOption) ? "selected" : "") + " value='" + (key) + "' >" + (titles[index] || key) + "</option>";
    });

    return optionsString;
  }

  HTMLElement.prototype.$GetButtonElement = function(Dictionary, options) {
    var buttonString = '<div class="btn-group">';

    options.forEach(function(option) {
      buttonString += this.__HTMLParser__(Dictionary, '<button data-itemspath="{{path}}" type="button"');
      buttonString += this.__HTMLParser__(option, 'id="{{id}}" title="{{title}}" style="{{style}}" data-whichway="{{whichWay}}" class="btn btn-default" onclick="{{event}}" >');
      buttonString += this.$GetIconElement(option);
      buttonString += this.__HTMLParser__(option, '{{label}}');
      buttonString += ' </button>';
    }.bind(this));

    buttonString += '</div>';
    return buttonString;
  }

  HTMLElement.prototype.$AddDescription = function(Dictionary) {
    var descriptionString = "";
    if (!Dictionary.description)
      return descriptionString;

    descriptionString += this.__HTMLParser__(Dictionary, "<p class='help-block' style='{{descriptionStyle}}' >{{description}}</p>");

    return descriptionString;
  }


  HTMLElement.prototype.$GetIconElement = function(option) {
    return this.__HTMLParser__(option, '<i {{iconColor}} class="glyphicon {{icon}}"></i>');
  }

  HTMLElement.prototype.$AddToolTip = function(Dictionary) {
    var toolTipHTML = "";

    if (Dictionary.tooltip)
      toolTipHTML += this.__HTMLParser__(Dictionary, '<span title="{{tooltip}}" data-toggle="tooltip" data-placement="bottom" data-html="true" style="color: rgb(80, 151, 186); display: inline-block; font-weight: bold; height: 26px; margin: 5px; padding: 0px; font-size: 16px; text-align: center; vertical-align: middle; width: 23px; cursor: pointer; background-image: url(&quot;data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz48IURPQ1RZUEUgc3ZnIFBVQkxJQyAiLS8vVzNDLy9EVEQgU1ZHIDEuMS8vRU4iICJodHRwOi8vd3d3LnczLm9yZy9HcmFwaGljcy9TVkcvMS4xL0RURC9zdmcxMS5kdGQiPjxzdmcgdmVyc2lvbj0iMS4xIiBpZD0iQ2FwYV8xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4PSIwcHgiIHk9IjBweCIgd2lkdGg9IjIyLjYwNXB4IiBoZWlnaHQ9IjI1LjU5OHB4IiB2aWV3Qm94PSIwIDAgMjIuNjA1IDI1LjU5OCIgZW5hYmxlLWJhY2tncm91bmQ9Im5ldyAwIDAgMjIuNjA1IDI1LjU5OCIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+PGc+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGZpbGw9IiM0MThFQjUiIGQ9Ik0xMS4zNjIsMjUuNTk4Yy0xLjE0Ny0xLjE0MS0yLjIyNS0yLjIxOC0zLjMxMy0zLjI4NGMtMC4xMzYtMC4xMzUtMC4zMTgtMC4yMzktMC40OTctMC4zMTFjLTQuMTUzLTEuNjI5LTYuNzM3LTQuNTk5LTcuNDE3LTkuMDI0Yy0wLjkxNy01Ljk2LDIuOTQ4LTExLjQzNiw4Ljg1LTEyLjcyOGM1Ljk1OC0xLjMwNSwxMi4wMiwyLjU5OSwxMy4zNDksOC41OTZjMS4yNDQsNS42MjItMS44NjksMTEuMjMtNy4zMDIsMTMuMTYxYy0wLjE4MiwwLjA2NS0wLjM1OSwwLjE4Mi0wLjQ5NSwwLjMxNmMtMC45OTEsMC45OC0xLjk3NCwxLjk3Mi0yLjk1NCwyLjk2M0MxMS40OTMsMjUuMzc4LDExLjQzMSwyNS40OTksMTEuMzYyLDI1LjU5OHogTTExLjcwOSwxOS43MDJjNC40ODgtMC4yMDksOC4xNDktMy45NzUsNy45NzEtOC42NzFjLTAuMTc5LTQuNzEyLTQuMTU4LTguMzQzLTguNzc1LTguMDg5Yy00LjY3LDAuMjU5LTguMTUzLDQuMTEyLTcuOTksOC42NjRDMy4wODYsMTYuNDU4LDcuMTgyLDE5LjkzNywxMS43MDksMTkuNzAyeiIvPjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBmaWxsPSIjNDE4RUI1IiBkPSJNOS4yNDIsOS40NGMxLjEyMywwLDIuMjI2LDAsMy4zNjIsMGMwLDEuOTc5LDAsMy45MzQsMCw1LjkxM2MwLjI3MSwwLjAxNiwwLjUxMiwwLjAyOSwwLjc2NSwwLjA0M2MwLDAuNDI3LDAsMC44MjUsMCwxLjI1NWMtMS4zNjgsMC0yLjczLDAtNC4xMjQsMGMwLTAuMzk1LDAtMC44MDEsMC0xLjI1YzAuMjI0LTAuMDE1LDAuNDY0LTAuMDI5LDAuNzI4LTAuMDQ2YzAtMS41MzYsMC0zLjA2MywwLTQuNjI2Yy0wLjI0MSwwLTAuNDcyLDAtMC43MywwQzkuMjQyLDEwLjI5MSw5LjI0Miw5Ljg4Myw5LjI0Miw5LjQ0eiIvPjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBmaWxsPSIjNDE4RUI1IiBkPSJNMTEuMjk5LDguNjAyYy0wLjcxNCwwLTEuMzE0LTAuNjAzLTEuMzA0LTEuMzFjMC4wMS0wLjY5NSwwLjYwMy0xLjI3NiwxLjMwMi0xLjI3N2MwLjY5Ny0wLjAwMSwxLjI5MiwwLjU4MiwxLjMwNCwxLjI3NkMxMi42MTMsNy45OTQsMTIuMDA4LDguNjAyLDExLjI5OSw4LjYwMnoiLz48L2c+PC9zdmc+&quot;); background-repeat: no-repeat;"></span>');

    return toolTipHTML;
  }

  HTMLElement.prototype.$CreateFilterContainer = function(Dictionary) {
    var filterContainer = '<div class="filter-container web-filter"> <div class="well well-sm filterable"> <div class="col-sm-8">';
    filterContainer += this.__HTMLParser__(Dictionary, '<input id="searcheditor" type="text" class="form-control" placeholder="{{options.filterable}}" style="width: 100%;"');
    filterContainer += this.__HTMLParser__(self.events, 'oninput="{{search}}"/></div><div><button onclick="{{search}}" class="btn btn-default">Search</button><button onclick="{{clear}}" class="btn btn-default">Clear</button></div></div></div>');
    return filterContainer;
  }


  function HTMLWrappers() {
    HTMLElement.call(this);
  }

  utilClass.$Inheritance(HTMLWrappers, HTMLElement);



  HTMLWrappers.prototype.$GetRootWrapper = function(Dictionary, callback, createHeading) {
    var rootHTML = "<div class='{{rootWrapperClass}}' " +
      "data-schematype='{{type}}' " +
      "data-schemapath='{{path}}' " +
      "style='position: relative;display:inherit'>";

    this.HTML.HTMLString += this.__HTMLParser__(Dictionary, rootHTML);

    this.HTML.HTMLString += this.$CreateFormElements(Dictionary, createHeading);

    if (Dictionary.options && typeof Dictionary.options.filterable !== "undefined")
      this.HTML.HTMLString += this.$CreateFilterContainer(Dictionary);

    this.$GetWell(Dictionary, callback);

    this.HTML.HTMLString += "</div>";
  }



  HTMLWrappers.prototype.$GetWell = function(Dictionary, callback) {
    if (callback && typeof callback === "function") {
      var wellHTML = "<div class='{{wellWithScrollClass}}' style='{{wellWithScrollStyle}}'>";
      this.HTML.HTMLString += this.__HTMLParser__(Dictionary, wellHTML);
      callback();

      // added to clear float left/right
      this.HTML.HTMLString += "<div class='clear'></div>";

      // for showing no results in manage price filter functionality
      if (self.textNoResults && Dictionary.path === "root")
        this.HTML.HTMLString += this.__HTMLParser__(self, "<div id='textNoResults'>{{textNoResults}}</div>");

      this.HTML.HTMLString += "</div>";
    }
  }


  HTMLWrappers.prototype.$GetObjectWrapper = function(Dictionary, callback) {
    var objectHTML = '<div data-id="{{dataID}}" class="row padding-5 {{wrapLevelClass}}" style="display:{{display}};{{wrapLevelWidth}}">'
    this.HTML.HTMLString += this.__HTMLParser__(Dictionary, objectHTML);
    this.$GetRootWrapper(Dictionary, callback, true);
    this.HTML.HTMLString += "</div>";
  }

  function HTMLParser(HTML) {
    this.HTML = HTML;
    HTMLWrappers.call(this);
  }

  utilClass.$Inheritance(HTMLParser, HTMLWrappers);

  HTMLParser.prototype.__ParseJSON__ = function(Dictionary, callback) {

    switch (Dictionary.type) {
      case 'string':
      case 'number':
      case 'integer':
      case 'boolean':
        this.__StringParser__(Dictionary, callback);
        break;
      case 'object':
      case undefined:
        this.__ObjectParser__(Dictionary, callback);
        break;
      case 'array':
        this.__ArrayParser__(Dictionary, callback);
        break;
    }
  }

  HTMLParser.prototype.__HTMLParser__ = function(Dictionary, HTML) {
    var keys = getBindingVariables(HTML);
    var values = [];

    keys.forEach(function(key) {
      var value = getValuesFromKeys(Dictionary, key);
      values.push(value !== undefined ? value : "");
    })

    var parsedHTML = setBindingVariables(HTML, keys, values);
    return parsedHTML;
  }


  function getValuesFromKeys(o, s) {
    s = s.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
    s = s.replace(/^\./, ''); // strip a leading dot
    var a = s.split('.');

    for (var i = 0, n = a.length; i < n; ++i) {
      var k = a[i];

      if (k in o) {
        o = o[k];
      } else {
        return;
      }
    }
    return o;
  }

  function getBindingVariables(str) {
    if (str.indexOf("{{") !== -1)
      return str.trim().match(/{{\s*[\w\.]+\s*}}/g).map(function(x) {
        return x.match(/[\w\.]+/)[0];
      });
  }

  function setBindingVariables(str, from, With) {
    for (var i = 0; i < from.length; i++) {
      str = str.replace(new RegExp('{{' + from[i] + '}}', 'gi'), With[i]);
    }
    return str;
  }

  HTMLParser.prototype.__StringParser__ = function(Dictionary, callback) {
    this.$GetObjectWrapper(Dictionary, callback);
  }

  HTMLParser.prototype.__ObjectParser__ = function(Dictionary, callback) {
    var path = Dictionary.path;
    if (path === 'root') {
      this.$GetRootWrapper(Dictionary, callback, false)
    } else
      this.$GetObjectWrapper(Dictionary, callback);
  }

  HTMLParser.prototype.__ArrayParser__ = function(Dictionary, callback) {


    this.$GetObjectWrapper(Dictionary, function() {
      this.HTML.HTMLString += "<div items-container>";
      callback();
      this.HTML.HTMLString += "</div>"
      this.HTML.HTMLString += this.$GetItemButtons(Dictionary);
    }.bind(this));
  }


  return HTMLParser;
})();

var Editor = (function() {
  var htmlParser;

  function Editor(process) {
    this.__InitializeProcess__(process);

    htmlParser = new HTMLParser(this.HTML);

    this.__PreBuild__(process.options.schema, process.options.initialValues);

    this.__PostBuild__(process.options.schema);

    return this.__ReturnEditor__(process.task, process.options.schema);
  }

  Editor.prototype.__PreBuild__ = function(Schema, InitialValues) {
    (function(Schema, InitialValues, parentPath) {

      walkPreBuildSchema(Schema, InitialValues, Schema.required, parentPath,
        function(Schema, InitialValues, prefix, key, required) {
          new Getters(prefix, key, Schema, required, InitialValues);

          self.Dictionary[prefix + key] = JSON.parse(JSON.stringify(Schema));

          delete self.Dictionary[prefix + key].properties;
        });

    })(Schema, InitialValues, this.itemsPath);

  }

  Editor.prototype.__PostBuild__ = function(Schema) {
    var that = this;
    (function(Schema) {

      walkPostBuildSchema(Schema, function(path) {
        var Dictionary = self.Dictionary[path];

        if (Dictionary.externalValidation) {
          that.externalvalidationurl.push(Dictionary.path);
        }

        Dictionary.isRequired = utilClass.$checkrequiredFieldPostBuild(Dictionary);
        Dictionary.isReadOnly = utilClass.$isReadOnlyPostBuild(Dictionary);

        Dictionary.display = utilClass.$isHidden(Dictionary);
        Dictionary.isRendering = utilClass.$IsRendering(Dictionary);

        Dictionary.validations = ValidationsClass.initValidation(Dictionary);

        ValidationsClass.IsDictionaryValid(Dictionary);

        Dictionary.hasError = Dictionary.hideValidationMssg ? "" :
          Dictionary.isValid === false ? "has-error" : "";

        utilClass.$addError(Dictionary);
        return Dictionary;
      });

    })(Schema);
  }


  Editor.prototype.__ReturnEditor__ = function(task, Schema) {
    return {
      "Schema": Schema,
      "task": task,
      "HTMLString": this.HTML.HTMLString,
      "selector": this.selector, // may be this is not required
      "contractLength": self.contractLength,
      "dateCalculations": self.dateCalculations,
      "multipleOfCalculation": self.multipleOfCalculation,
      "Editor": {
        "Dictionary": self.Dictionary,
        "Dependencies": self.Dependencies,
        "Errors": self.errors,
        "requireToggle": self.requireToggle,
        "disableToggle": self.disableToggle,
        "externalvalidationurl": this.externalvalidationurl,
        "count": self.count,
        "multipleDependency": self.multipleDependency,
        "hideDependency": self.hideDependency
      }
    }
  }

  Editor.prototype.__InitializeProcess__ = function(process) {
    self.validateConfiguration = process.options.validateConfiguration === "true" ? true : false;
    self.Scrollable = process.options.scrollable;
    self.heading = process.options.heading;
    self.Translations = process.options.translations;
    self.Validations = process.options.Validations;
    self.Definations = process.options.schema.definitions || {};
    self.events = process.options.events;
    self.Dictionary = {};
    self.Dependencies = {};
    self.requireToggle = {};
    self.disableToggle = {};
    self.errors = [];
    self.locale = process.options.locale;
    self.contractLength = '';
    self.dateCalculations = {},
      self.multipleOfCalculation = [],
      self.validations = [],
      this.HTML = {
        HTMLString: ''
      },
      this.itemsPath = process.options.itemsPath;

    this.externalvalidationurl = [];
    self.count = process.options.count || 0;
    self.numberFormaters = process.options.numberFormaters;
    self.hideDependency = {};
    self.wrapLevel = process.options.wrapLevel;
    self.textNoResults = process.options.textNoResults;
  }



  function walkPreBuildSchema(Schema, InitialValues, required, prefix, callback) {
    prefix = (typeof prefix !== 'undefined') ? (prefix + '.') : 'root';

    if (prefix === "root") {
      if (callback && typeof callback === "function")
        callback(Schema, InitialValues, prefix, "", required);

      walkPreBuildSchema(Schema.properties, InitialValues, required, prefix, callback);
    } else {
      for (var key in Schema) {
        if (callback && typeof callback === "function")
          callback(Schema[key], (InitialValues && InitialValues[key]), prefix, key, required);

        if (Schema[key].properties)
          walkPreBuildSchema(Schema[key].properties, (InitialValues && InitialValues[key]), Schema[key].required, prefix + key, callback)
        else if (Schema[key].items && InitialValues && InitialValues[key] && InitialValues[key].length) {
          Schema[key].items_ = [];
          InitialValues[key].forEach(function(item, index) {

            var itemsSchema = {};
            var items_ = JSON.parse(JSON.stringify(Schema[key].items));
            Schema[key].items_.push(items_);

            itemsSchema[index] = items_;
            itemsSchema[index].itemsIterator = true;
            walkPreBuildSchema(itemsSchema, (InitialValues && InitialValues[key]), Schema[key].required, prefix + key, callback)
          })
        }
      }
    }

  }

  function walkPostBuildSchema(Schema, callback) {
    var Dictionary;

    if (Schema.path === "root") {
      if (callback && typeof callback === "function")
        Dictionary = callback(Schema.path);

      htmlParser.__ParseJSON__(Dictionary, function() {
        walkPostBuildSchema(Schema.properties, callback);
      });
    } else {
      var property_Order = utilClass.$sortByPropertyOrder(Schema);

      property_Order.forEach(function(key) {
        if (Schema[key].path) {
          if (callback && typeof callback === "function")
            Dictionary = callback(Schema[key].path);

          if (Schema[key].type === "array" && Schema[key].items) {
            htmlParser.__ParseJSON__(Dictionary, function() {
              if (Dictionary.value && Dictionary.value.length) {
                Dictionary.value.forEach(function(value, index) {
                  var itemsSchema = {};
                  itemsSchema[index] = Schema[key].items_[index];
                  walkPostBuildSchema(itemsSchema, callback);
                })
              }
            });
          } else if (Schema[key].properties) {
            htmlParser.__ParseJSON__(Dictionary, function() {
              walkPostBuildSchema(Schema[key].properties, callback);
            });
          } else {
            htmlParser.__ParseJSON__(Dictionary);
            if (Dictionary.type === "number" || Dictionary.type === "integer") {
              Dictionary.value = parseFloat(utilClass.$HandleNumberFields(Dictionary.value, self.numberFormaters));
            }
          }
        }
      });
    }
  }

  return Editor;

})();

/**
 * @Web Worker based JSON schema editor
 * (c) Bluesky Westcon
 */

/**
 * Worker based JSON schema editor is a JavaScript library
 * for creating dynamic html form via JSON Schema
 * Support- Validations(String, Number, Boolean), RequireToggle, disableToggle, Dependencies etc...
 * Provides light weight HTML form creation using Web Worker Technology
 */

(function(requireClass) {
  onmessage = function(e) {
    var process = e.data[0];

    if (!process) {
      return;
    }

    switch (process.task) {
      case 'SchemaForm':
      case 'ItemsForm':
        var asyncEditor = new Editor(process);
        break;
    }

    sendHtml(asyncEditor);
    close();
  };

  function sendHtml(asyncEditor) {
    postMessage(asyncEditor);
  }

})();

})();
