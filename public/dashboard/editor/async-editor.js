(function() {
  var Editor = arguments[0];
  var UtilClass = arguments[3]();
  var ValidationsClass = arguments[2](UtilClass);
  var EventsClass = arguments[1](UtilClass, ValidationsClass);
  var translationsInitializer = arguments[4]();
  var webWorkerFile = arguments[5];

  UtilClass.$GetWebWorkerBlob(webWorkerFile, function(webWorkerBlob) {
    window.DomWorker = Editor(UtilClass, EventsClass, ValidationsClass, webWorkerBlob, translationsInitializer);
  });
})(function(UtilClass, EventsClass, ValidationsClass, webWorkerBlob, translationsInitializer) {

  /**
   * DomWorkerClass:- manipulates the editor
   */
  function DomWorker(element, options) {
    this.$InitializeEditor(element, options);
    this.$AddEvents();

    var initOptions = this.$GetInitOptions("SchemaForm");
    this.$InitEditor(initOptions);

    return {
      "$on": UtilClass.$on.bind(this)
    };
  }

  UtilClass.$Inheritance(DomWorker, EventsClass);

  DomWorker.prototype.$InitEditor = InitEditor;
  DomWorker.prototype.$InitializeEditor = InitializeEditor;
  DomWorker.prototype.$GetInitOptions = GetInitOptions;
  DomWorker.prototype.$CreateDOM = CreateDOM;
  DomWorker.prototype.$AppendChild = AppendChild;
  DomWorker.prototype.$AddToolTip = AddToolTip;
  DomWorker.prototype.$AddDatePicker = AddDatePicker;
  DomWorker.prototype.$CalculateDates = CalculateDates;
  DomWorker.prototype.$CalculateStartDate = CalculateStartDate;
  DomWorker.prototype.$CalculateEndDate = CalculateEndDate;
  DomWorker.prototype.$Digest = Digest;
  DomWorker.prototype.$UpdateDictionary = UpdateDictionary;
  DomWorker.prototype.$ProcessEventLoop = ProcessEventLoop;
  DomWorker.prototype.$ContractLengthChanged = ContractLengthChanged;
  DomWorker.$Translations = translationsInitializer;

  return DomWorker;

  function ProcessEventLoop() {
    if (this.eventLoop.length) {
      this.eventLoop.forEach(function(callback) {
        if (typeof callback === "function")
          callback.call(this);
      }.bind(this));

      this.eventLoop = [];
    }
  }

  function InitEditor(initOptions) {
    this.WebWorkerEditor = new Worker(webWorkerBlob);
    this.WebWorkerEditor.postMessage(initOptions);
    this.WebWorkerEditor.onmessage = OnEditorCreated.bind(this);
  }

  function InitializeEditor(element, options) {
    this.element = element.length ? element[0] : element;
    this.options = options;
    this.errors = [];
    this.externalValidationErrors = [];
    this.eventLoop = [];
    this.count = 0;
    this.enableUTCDate = false;
    EventsClass.call(this);
    // for MNO there will be no translations
    if(!this.options.translations) {
      this.options.translations = {};
      this.options.translations.errorTranslations = {};
      this.options.translations.productSchemaTranlations = {};
    }
  }

  function GetInitOptions(taskName, schema, initialValues, itemsPath) {
    return [{
      task: taskName,
      options: {
        validateConfiguration: this.options.validateConfiguration,
        schema: schema || this.options.schema,
        initialValues: initialValues || this.options.initialValues,
        scrollable: this.options.scrollable,
        heading: this.options.heading,
        translations: UtilClass.$Translations.call(this),
        events: this.parsedEvents,
        itemsPath: itemsPath,
        locale: this.options.$locale.locate,
        count: this.count,
        numberFormaters: this.options.$locale.NUMBER_FORMATS,
        wrapLevel: this.options.wrapLevel || null,
        textNoResults: this.options.textNoResults
      }
    }];
  }

  function OnEditorCreated(e) {
    this.errors = this.errors.concat(e.data.Editor.Errors);
    this.externalValidationErrors = this.externalValidationErrors.concat(e.data.Editor.externalValidationErrors);
    this.$ProcessEventLoop();
    var doc = this.$CreateDOM(e.data.HTMLString),
      selector;

    switch (e.data.task) {
      case 'SchemaForm':
        this.contractLength = e.data.contractLength;
        this.editor = e.data.Editor;
        this.editor.dynamicErrors = this.errors;
        this.count = e.data.Editor.count;
        this.$AddToolTip(doc.body);
        this.$CalculateDates(e.data.dateCalculations);
        this.$AddDatePicker(doc.body);
        selector = "#editorjsonform";
        break;
      case 'ItemsForm':
        selector = "[items-container]";
        this.$UpdateDictionary(e.data.Editor.Dictionary);
        break;
    }

    this.editor.getValue = UtilClass.$getValue.bind(this);
    this.editor.setValue = $RecreateEditor.bind(this);
    this.$AppendChild(selector, doc.body.children);
    MultipleOf.call(this, e.data.multipleOfCalculation);
    this.WebWorkerEditor.terminate();

    if (this.load)
      this.load();
  }

  // calculating multipleOf in webworker is not possible because we are using a very heavy
  // library to do it. It is not a good practice to send that library to web worker
  function MultipleOf(multipleOfCalculation) {
    if (multipleOfCalculation && multipleOfCalculation.length) {
      this.busy = true;
      multipleOfCalculation.forEach(function(path) {
        var currentTarget = this.element.querySelector("[data-origname='" + path + "']");
        if (currentTarget)
          this.$Apply(currentTarget, true, function(currentDictionary) {
            this.handleNumericFields(currentDictionary, currentTarget, this.options.$locale.NUMBER_FORMATS);
          });
      }.bind(this));
      this.busy = false;
    }
  };

  function $RecreateEditor(configuration, path) {
    this.busy = true; // forcing editor not to fire change or error callback untill configurations are updated/validated

    $WalkObject(configuration, path, function(path, value) {
      var element = this.element.querySelector("[data-origname='" + path + "']");
      var newValue = isNaN(parseFloat(value)) ? value : parseFloat(value);

      if (element && element.value != newValue) {
        updateElementValue(element, value);

        if (element.onchange)
          element.onchange({ "currentTarget": element });
      }
    }.bind(this));

    this.busy = false;
    this.$Digest(); // firing editor function change/error

    function updateElementValue(element, value) {
      if (element.type === "checkbox")
        element.checked = value;
      else {
        element.value = value;
        element.classList.add("value-changed");

        (function(element) {
          setTimeout(function() {
            element.classList.remove("value-changed");
          }, 5000);
        })(element)
      }
    }
  }



  function $WalkObject(object, prefix, callback) {
    prefix = (typeof prefix !== 'undefined') ? (prefix + '.') : 'root';

    for (var key in object) {
      var value = object[key];

      if (callback && typeof callback === "function" && typeof value !== "object")
        callback(prefix + key, value);

      if (typeof value === "object")
        $WalkObject(value, prefix + key, callback);
    }
  }

  function UpdateDictionary(Dictionary) {
    for (var key in Dictionary) {
      this.editor.Dictionary[key] = Dictionary[key];
    }
  }

  function CalculateDates(datesObject) {
    if (!Object.keys(datesObject).length)
      return;

    var contractLength = this.contractLength.toLowerCase();
    this.$CalculateStartDate(datesObject.startDate);
    this.$CalculateEndDate(datesObject, contractLength);
  }

  function CalculateStartDate(path) {
    var currentDictionary = UtilClass.$GetCurrentDictionary.call(this, path),
      date;

    if (!currentDictionary)
      return;

    var datepickerFormat = (moment().toMomentFormatString(this.options.$locale.DATETIME_FORMATS.shortDate)).replace('YY', 'YYYY') || 'MM/DD/YYYY';
    date = moment().utc().format(datepickerFormat);
    currentDictionary.value = date;
  }

  function CalculateEndDate(datesObject, contractLength, element, calendarDate) {
    var endDateDictionary = UtilClass.$GetCurrentDictionary.call(this, datesObject.endDate),
      startDateDictionary = UtilClass.$GetCurrentDictionary.call(this, datesObject.startDate),
      endDate, month, year;

    if (!endDateDictionary || !startDateDictionary || !startDateDictionary.value)
      return;

    if (contractLength.toLowerCase() === "open") {
      if (startDateDictionary && startDateDictionary.options && startDateDictionary.options.hidden &&
        endDateDictionary && endDateDictionary.options && endDateDictionary.options.hidden)
        endDateDictionary.value = "";
      else
        endDateDictionary.value = contractLength.toLowerCase();

      if (element)
        element.value = endDateDictionary.value;

      return;
    }

    var datepickerFormat = (moment().toMomentFormatString(this.options.$locale.DATETIME_FORMATS.shortDate)).replace('YY', 'YYYY') || 'MM/DD/YYYY';

    var quantity, unit;

    if (contractLength === 'yearly') {
      unit = 'y';
      quantity = 1;
    } else if (contractLength.indexOf("year") !== -1) {
      unit = 'y';
      quantity = parseInt(contractLength);
    } else if (contractLength.indexOf("monthly") !== -1) {
      quantity = 1;
      unit = 'M';
    } else if (contractLength.indexOf("month") !== -1) {
      quantity = parseInt(contractLength);
      unit = 'M';
    } else if (contractLength.indexOf('annual') !== -1) {
      quantity = 12;
      unit = 'M';
    } else { ///Products with a Montlhy contract length
      quantity = 1;
      unit = 'M';
    }

    endDateDictionary.value = moment(startDateDictionary.value, datepickerFormat).add(quantity, unit).add(-1, 'days').format(datepickerFormat);

    var argument = [calendarDate, endDateDictionary, startDateDictionary, datepickerFormat, element, quantity, unit]
    setEndDateToElement.apply(this, argument);
  }

  function setEndDateToElement(calendarDate, endDateDictionary, startDateDictionary, datepickerFormat, element, quantity, unit) {
    if (element) {
      if (this.enableUTCDate && calendarDate) {
        var calendarStartDate = moment(calendarDate, datepickerFormat).date();
        var endDate = moment(endDateDictionary.value, datepickerFormat).date();

        if (calendarStartDate === endDate)
          element.value = moment(endDateDictionary.value, datepickerFormat).add(-1, 'days').format(datepickerFormat);
        else
          element.value = moment(startDateDictionary.value, datepickerFormat).add(quantity, unit).format(datepickerFormat);
      } else
        element.value = endDateDictionary.value;
    }
  }

  function AddDatePicker(doc) {
    var calendarButton = doc.querySelectorAll(".calendar-datepicker");
    if (!calendarButton.length)
      return

    var monthNames, monthNamesShort, dayNames, dayNamesShort, datepickerFormat,
      that = this,
      endDateElement;

    monthNames = JSON.parse(sessionStorage.getItem('monthNames'));
    monthNamesShort = JSON.parse(sessionStorage.getItem('monthNamesShort'));
    dayNames = JSON.parse(sessionStorage.getItem('dayNames'));
    dayNamesShort = JSON.parse(sessionStorage.getItem('dayNamesShort'));

    datepickerFormat = (moment().toMomentFormatString(this.options.$locale.DATETIME_FORMATS.shortDate)).toLowerCase();

    window.jQuery.datepicker.setDefaults(window.jQuery.datepicker.regional[this.options.language]);
    window.jQuery.datepicker.setDefaults({
      "dateFormat": datepickerFormat
    });

    endDateElement = calendarButton[1];

    for (var i = 0; i < calendarButton.length; i++) {
      btn = calendarButton[i];
      $(btn.nextElementSibling).datepicker({
        firstDay: 1,
        monthNames: monthNames,
        monthNamesShort: monthNamesShort,
        dayNames: dayNames,
        dayNamesShort: dayNamesShort,
        dayNamesMin: dayNamesShort,
        orientation: "top",
        changeMonth: showChangeYearAndMonth(),
        changeYear: showChangeYearAndMonth(),
        onSelect: function() {
          var startDateDictionary = UtilClass.$GetCurrentDictionary.call(that, this.dataset.origname);
          startDateDictionary.value = getUTCDate.call(that, this.value);

          if (endDateElement && endDateElement.nextElementSibling) {
            var datesObject = {
              startDate: this.dataset.origname,
              endDate: endDateElement.nextElementSibling.dataset.origname
            };
            that.$CalculateEndDate(datesObject, that.contractLength, endDateElement.nextElementSibling, this.value);
          } else if (that.editor.Dictionary["root.contract.endDate"] && that.contractLength.toLowerCase() === "open") {
            that.editor.Dictionary["root.contract.endDate"].value = that.contractLength.toLowerCase();
          }


          for (var i = 0; i < calendarButton.length; i++) {
            var currentTarget = calendarButton[i].nextElementSibling;
            that.$Apply(currentTarget, false);
          }

        }
      });
    }
  }

  function getUTCDate(selectedDate, dateFormat) {
    var dateFormat = (moment().toMomentFormatString(this.options.$locale.DATETIME_FORMATS.shortDate)).replace('YY', 'YYYY') || 'MM/DD/YYYY';
    var localDate = new Date().getDate(),
      calendarDate = moment(selectedDate, dateFormat).date(),
      utcDate;

    if (localDate === calendarDate) {
      utcDate = moment().utc().format(dateFormat);
      this.enableUTCDate = calendarDate === moment(utcDate, dateFormat).date() ? false : true;
    } else
      this.enableUTCDate = false;

    return utcDate || selectedDate;
  }

  function ContractLengthChanged(currentDictionary) {
    this.contractLength = currentDictionary.value.toLowerCase();
    var datesObject = {
      startDate: "root.contract.startDate",
      endDate: "root.contract.endDate"
    };

    var endDateElement = this.element.querySelector("[data-origname='" + datesObject.endDate + "']");
    var startDateElement = this.element.querySelector("[data-origname='" + datesObject.startDate + "']");
    this.$CalculateEndDate(datesObject, this.contractLength, endDateElement, startDateElement.value);

    for (var path in datesObject) {
      var currentTarget = this.element.querySelector("[data-origname='" + datesObject[path] + "']");
      if (currentTarget.value)
        this.$Apply(currentTarget, false);
    }
  }

  function showChangeYearAndMonth(changeYearAndMonth) {
    return changeYearAndMonth !== undefined ? changeYearAndMonth : true;
  };

  function CreateDOM(html) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, "text/html");
    return doc;
  }

  function AppendChild(selector, newElements) {
    var target = this.element.querySelector(selector);
    Array.prototype.slice.call(newElements).forEach(function(element) {
      target.appendChild(element);
    })
  }

  function AddToolTip(doc) {
    $(doc).find('[data-toggle="tooltip"]').tooltip();
  }

  function Digest() {
    if (this.errors.length)
      this.error()
    else
      this.change();
  }



},function(UtilClass, ValidationsClass) {
  /**
   * EventsClass:- listen to editor events
   */

  function EventsClass() {};

  EventsClass.prototype.$AddEvents = AddEvents;
  EventsClass.prototype.handleInput = handleInput;
  EventsClass.prototype.handleDatePicker = handleDatePicker;
  EventsClass.prototype.handleSelect = handleSelect;
  EventsClass.prototype.collapse = collapse;
  EventsClass.prototype.addItems = addItems;
  EventsClass.prototype.deleteAllItems = deleteAllItems;
  EventsClass.prototype.deleteItems = deleteItems;
  EventsClass.prototype.deleteFromDictionary = deleteFromDictionary;
  EventsClass.prototype.removeFromArrayErrors = removeFromArrayErrors;
  EventsClass.prototype.reorderItems = reorderItems;
  EventsClass.prototype.$Apply = Apply;
  EventsClass.prototype.clearFilter = clearFilter;
  EventsClass.prototype.handleSearch = handleSearch;
  EventsClass.prototype.showSearchItems = showSearchItems;
  EventsClass.prototype.handleTextArea = handleTextArea;
  EventsClass.prototype.handleCheckbox = handleCheckbox;
  EventsClass.prototype.moveDown = moveDown;
  EventsClass.prototype.moveUp = moveUp;
  EventsClass.prototype.togglePosition = togglePosition;
  EventsClass.prototype.handleNumericFields = handleNumericFields;


  var $Events = {
    "add": "addItems{{schemaId}}(event)",
    "input": "handleInput{{schemaId}}(event)",
    "click": "handleClick{{schemaId}}(event)",
    "collapse": "collapse{{schemaId}}(event)",
    "delete": "deleteItems{{schemaId}}(event)",
    "change": "handleCheckbox{{schemaId}}(event)",
    "select": "handleSelect{{schemaId}}(event)",
    "deleteAll": "deleteAllItems{{schemaId}}(event)",
    "textarea": "handleTextArea{{schemaId}}(event)",
    "datepicker": "handleDatePicker{{schemaId}}(event)",
    "search": "handleSearch{{schemaId}}(event)",
    "clear": "clearFilter{{schemaId}}(event)",
    "moveDown": "moveDown{{schemaId}}(event)",
    "moveUp": "moveUp{{schemaId}}(event)"
  };


  return EventsClass;

  function handleSearch(event) {
    var searchValue = this.element.querySelector("#searcheditor").value;
    if (searchValue.trim() === "") {
      this.showSearchItems(searchValue.toLowerCase(), "block");
      return;
    }

    this.showSearchItems(searchValue.toLowerCase(), "none");
  }

  function showSearchItems(searchValue, display) {
    var filterList = Object.keys(this.editor.Dictionary).filter(function(key) {
      var currentDictionary = this.editor.Dictionary[key];

      if (key !== "root" && key.split(".").length === 2 && currentDictionary.display !== "none") {
        if (searchValue === "" || currentDictionary.title.toLowerCase().indexOf(searchValue) === -1) {
          this.element.querySelector("div[data-id='" + currentDictionary.dataID + "']").style.display = display;
          if (display === "block")
            return key;
        } else if (currentDictionary.title.toLowerCase().indexOf(searchValue) !== -1) {
          this.element.querySelector("div[data-id='" + currentDictionary.dataID + "']").style.display = "block";
          return key;
        }
      }
    }.bind(this));

    this.element.querySelector("#textNoResults").style.display = filterList.length === 0 ? "block" : "none";
  }

  function clearFilter(event) {
    var txtSearch = this.element.querySelector("#searcheditor");
    var searchValue = txtSearch.value;

    this.showSearchItems(searchValue.toLowerCase(), "block");
    txtSearch.value = "";
  }

  function deleteItems(event) {
    if (this.count > 1)
      UtilClass.$AddLoader.call(this, "div[items-container]");

    var itemPath = event.currentTarget.dataset.itemspath;
    var parentPath = itemPath.substr(0, itemPath.lastIndexOf("."));

    var deleteKey = itemPath.split(".").pop();

    this.element.querySelector('div[data-id="' + deleteKey + '"]').remove();

    this.count--;

    if (this.count === 0)
      this.element.querySelector("#deleteall").style.display = "none";

    // removing only current item from Dictionary so that we can create items again
    this.deleteFromDictionary(itemPath);

    // removing only current item errors from Dictionary if it is the only one
    this.removeFromArrayErrors(itemPath);

    var configuration = this.editor.getValue();

    var initialValuesPath = parentPath.replace("root.", "");
    var initialValues = UtilClass.$GetValueFromKey(initialValuesPath, configuration, ".");


    var schema = {},
      count = 0,
      newInitialValues = [];

    initialValues.forEach(function(item) {
      if (item !== undefined || item !== null) {
        schema[count] = JSON.parse(JSON.stringify(this.editor.Dictionary[parentPath].items));
        schema[count].itemsIterator = true;
        count++;
        newInitialValues.push(item);
      }
    }.bind(this));

    this.reorderItems(parentPath, newInitialValues, schema);
  };

  function moveDown(event) {
    this.togglePosition(event);
  }

  function togglePosition(event) {
    event.stopPropagation();
    UtilClass.$AddLoader.call(this, "div[items-container]")
    var whichWay = event.currentTarget.dataset.whichway;
    var itemPath = event.currentTarget.dataset.itemspath;
    var parentPath = itemPath.substr(0, itemPath.lastIndexOf("."));
    var configuration = this.editor.getValue();
    var initialValuesPath = parentPath.replace("root.", "");
    var initialValues = UtilClass.$GetValueFromKey(initialValuesPath, configuration, ".");

    var currentPosition = parseInt(itemPath.split(".").pop());
    var newPosition;

    if (whichWay === "up") {
      newPosition = currentPosition - 1;
    } else if (whichWay === "down") {
      newPosition = currentPosition + 1;
    }

    if (initialValues[newPosition] || initialValues[newPosition] === "" || initialValues[newPosition] === 0) {
      swap.call(initialValues, currentPosition, newPosition);

      var schema = {},
        count = 0;

      initialValues.forEach(function(item) {
        if (item !== undefined || item !== null) {
          schema[count] = JSON.parse(JSON.stringify(this.editor.Dictionary[parentPath].items));
          schema[count].itemsIterator = true;
          count++;
          return item;
        }
      }.bind(this));

      this.reorderItems(parentPath, initialValues, schema);
    }
  }

  function swap(indexA, indexB) {
    var temp = this[indexA];
    this[indexA] = this[indexB];
    this[indexB] = temp;
  }

  function moveUp(event) {
    this.togglePosition(event);
  }

  function reorderItems(parentPath, initialValues, schema) {
    this.eventLoop.push(function() {
      var nodes = this.element.querySelector('div[items-container]');
      nodes.innerHTML = "";
      UtilClass.$RemoveLoader.call(this, "div[items-container]");
    });

    if (!initialValues.length) {
      this.$Digest();
      UtilClass.$RemoveLoader.call(this, "div[items-container]");
      return;
    }

    // removing all item elements from Dictionary
    this.deleteFromDictionary(parentPath);

    // removing all errors from this.errors who's path starts with parent path of items array schema
    this.removeFromArrayErrors(parentPath);

    var initOptions = this.$GetInitOptions("ItemsForm", schema, initialValues, parentPath);

    this.$InitEditor(initOptions);

  }


  function deleteAllItems(event) {

    var itemPath = event.currentTarget.dataset.itemspath;
    var nodes = this.element.querySelector('div[items-container]');
    nodes.innerHTML = ""
    this.count = 0;

    event.currentTarget.style.display = "none";
    this.deleteFromDictionary(itemPath);

    // delete from array - errors
    this.removeFromArrayErrors(itemPath);

    this.$Digest();

  };

  function removeFromArrayErrors(itemPath) {
    this.errors = this.errors.filter(function(path) {
      if (path.indexOf(itemPath) === -1)
        return true
    })
  }

  function deleteFromDictionary(itemPath) {
    var dictionary = this.editor.Dictionary;

    for (var key in dictionary) {
      if (dictionary[key].path && dictionary[key].path.indexOf(itemPath) === 0 && !dictionary[key].items)
        delete this.editor.Dictionary[key];
    }

  };

  function collapse(event) {
    var toggleWell = event.currentTarget.parentElement.parentElement.nextElementSibling;
    var btn = event.currentTarget.querySelector("i");
    toggleWell = toggleWell.nodeName === "P" ? toggleWell.nextElementSibling : toggleWell;

    if (toggleWell.style.display === "block" || toggleWell.style.display === "") {
      toggleWell.style.display = "none";
      btn.classList.add("glyphicon-chevron-right");
      btn.classList.remove("glyphicon-chevron-down");
      btn.title = "Expand";
    } else {
      toggleWell.style.display = "block";
      btn.classList.remove("glyphicon-chevron-right");
      btn.classList.add("glyphicon-chevron-down");
      btn.title = "Collapse";
    }
  }

  function addItems(event) {
    var itemsPath = event.currentTarget.dataset.itemspath;
    event.currentTarget.nextElementSibling.style.display = "block";


    var configuration = this.editor.getValue();
    var initialValuesPath = itemsPath.replace("root.", "");
    var initialValues = UtilClass.$GetValueFromKey(initialValuesPath, configuration, ".");

    var schema_ = this.editor.Dictionary[itemsPath].items;
    var schema = {};
    var count = 0;


    initialValues.push(schema_.type === "object" ? {} : "");

    initialValues.forEach(function(item) {
      schema[count] = JSON.parse(JSON.stringify(schema_));
      schema[count].itemsIterator = true;
      count++;
    }.bind(this));

    this.count++;

    this.reorderItems(itemsPath, initialValues, schema);
  }


  function AddEvents() {
    this.parsedEvents = JSON.parse(JSON.stringify($Events));

    var schemaId = this.options.schemaName;
    var forHTML = "{{schemaId}}";
    var forWindow = "(event)";

    for (var key in this.parsedEvents) {
      var eventName = this.parsedEvents[key];
      this.parsedEvents[key] = eventName.replace(forHTML, schemaId);

      var originalEvent = eventName.replace(forHTML + forWindow, "");
      var windowEventName = this.parsedEvents[key].replace(forWindow, "");
      if (this[originalEvent])
        window[windowEventName] = this[originalEvent].bind(this);
    }
  }

  function handleDatePicker(event) {
    var element = event.currentTarget.nextElementSibling;

    if ((this.options.schema.disableFutureDates === true) && (element.getAttribute("data-origname") === "root.contract.startDate"))
      $(element).datepicker('change', { maxDate: new Date() });

    $(element).datepicker('show');
  }

  function Apply(currentTarget, changeValue, callback) {
    var currentDictionary = UtilClass.$GetCurrentDictionary.call(this, currentTarget.dataset.origname);

    if (changeValue)
      currentDictionary.value = currentTarget.value;

    if (callback && typeof callback === "function")
      callback.call(this, currentDictionary);

    if (currentDictionary.validations)
      ValidationsClass.validate(currentDictionary, currentTarget, this.errors, this.editor, this.element, this.options, this.$Digest.bind(this));

    if (!this.busy)
      this.$Digest();
  }


  function handleTextArea(event) {
    this.$Apply(event.currentTarget, true)
  };

  function handleCheckbox(event) {
    this.$Apply(event.currentTarget, false, function(currentDictionary) {
      currentDictionary.value = event.currentTarget.checked;

      if (currentDictionary.options && currentDictionary.options.dependencies) {
        var dependencies = currentDictionary.options.dependencies;
        var dictionaryPath = currentDictionary.path;

        dependencies.forEach(function(dependency) {
          UtilClass.$HandleDependency.call(this, dependency, currentDictionary, UtilClass, ValidationsClass);
        }.bind(this));
      }
    });
  }

  function handleSelect(event) {
    this.$Apply(event.currentTarget, true, function(currentDictionary) {
      if (currentDictionary.dataID === 'contractLength' || currentDictionary.dataID === 'contractTerm') {
        this.$ContractLengthChanged(currentDictionary);
        // ToDo :: add code for changing endDate
      }

      if (currentDictionary.options && currentDictionary.options.dependencies) {
        var dependencies = currentDictionary.options.dependencies;
        var dictionaryPath = currentDictionary.path;

        dependencies.forEach(function(dependency) {
          UtilClass.$HandleDependency.call(this, dependency, currentDictionary, UtilClass, ValidationsClass);
        }.bind(this));
      }
    })
  }



  function handleInput(event) {
    this.$Apply(event.currentTarget, true, function(currentDictionary) {
      this.handleNumericFields(currentDictionary, event.currentTarget, this.options.$locale.NUMBER_FORMATS);
    })
  }

  function handleNumericFields(currentDictionary, element, numberFormaters) {
    // type number and format = text
    // leaving field blank will set either default value or minimum value
    // entering alphabets - set either default value or minimum value
    if ((currentDictionary.type === "number" || currentDictionary.type === "integer") && currentDictionary.format === "text") {
      element.value = currentDictionary.value = UtilClass.$HandleNumberFields(currentDictionary.value, numberFormaters);

      if (isNaN(parseInt(currentDictionary.value))) {
        currentDictionary.value = currentDictionary.default !== undefined ? currentDictionary.default : 0;
        element.value = currentDictionary.value;
      } else {
        // excluding number because integer not allow decimal values
        // below code will remove decimal
        if (!isNaN(currentDictionary.value) && currentDictionary.type === "number")
          currentDictionary.value = parseFloat(currentDictionary.value);
      }
    }
  }

}, function(UtilClass) {


  /**
   * Validation for External Validation url
   */

  function ExternalValidationUrl() {};

  ExternalValidationUrl.prototype.$InitExternalValidation = InitExternalValidation;
  ExternalValidationUrl.prototype.$DisableExternalValidationElements = DisableExternalValidationElements;
  ExternalValidationUrl.prototype.$GetConfigurationNames = GetConfigurationNames;
  ExternalValidationUrl.prototype.$ValidateExternalValidation = ValidateExternalValidation;
  ExternalValidationUrl.prototype.$ExecuteEditorEvents = ExecuteEditorEvents;
  ExternalValidationUrl.prototype.$ShowExternalValidationSuccess = ShowExternalValidationSuccess;
  ExternalValidationUrl.prototype.$ShowExternalValidationErrors = ShowExternalValidationErrors;

  function InitExternalValidation(validation) {
    if (!this.Dictionary.options.externalValidation)
      return;

    var errors_ = this.editor.externalValidationErrors.filter(function(error) {
        return (this.errors.indexOf(error) !== -1);
    }.bind(this)).filter(function(error){
          return error !== this.Dictionary.path;
    }.bind(this));

    if (errors_.length)
      return;

    var externalValidationIDs = this.editor.externalvalidationurl;

    var configurationNames = this.$GetConfigurationNames(externalValidationIDs);

    var externalvalidationurl = this.options.externalvalidationurl.url + 'validate/' + this.options.externalvalidationurl.token + '&include=' + configurationNames;

    this.errors.push("ExternalValidationUrl");
    this.$ValidateExternalValidation(externalvalidationurl, externalValidationIDs);
  };

  function DisableExternalValidationElements(dictionaryPath, disabled, message, color, displayMessage) {
    var element = this.element.querySelector("[data-origname='" + dictionaryPath + "']");
    if (element) {
      element.disabled = disabled;

      if (displayMessage) {
        var external = element.parentElement.querySelector(".external");

        message = message ? message : "";
        external.innerHTML = message;

        if (color)
          external.style.color = color;
      }
    }
  }

  function GetConfigurationNames(externalValidationIDs) {
    var that = this;

    return externalValidationIDs.map(function(dictionaryPath) {
      var Dictionary = that.editor.Dictionary[dictionaryPath];
      var displayMessage = Dictionary.value || Dictionary.value === 0 ? true : false;

      var message = displayMessage ? "Validating..." : undefined;

      that.$DisableExternalValidationElements(dictionaryPath, true, message, "#2c83ae", true);

      return dictionaryPath.replace('root', 'configuration')
    }).join(",");
  }

  function ValidateExternalValidation(validateUrl, externalValidationIDs) {
    var dfd = window.jQuery.Deferred(),
      that = this;

    this.Dictionary.asyncValidation = true;

    var dataConfiguration = {
      "specification": {
        "id": this.options.externalvalidationurl.propertyId
      },
      configuration: this.editor.getValue()
    };


    var request = window.jQuery.ajax({
      url: validateUrl,
      method: 'PUT',
      contentType: "application/json",
      dataType: "json",
      data: JSON.stringify(dataConfiguration)
    });

    request.done(function(msg) {
      if (msg.status === 200) {
        that.$ExecuteEditorEvents(true);
        that.$ShowExternalValidationSuccess(msg.info);
      }
    });

    request.fail(function(jqXHR, textStatus) {
      if (jqXHR.responseJSON && jqXHR.responseJSON.status === 400) {
        that.$ExecuteEditorEvents(false, jqXHR.responseJSON.validationErrors);
        that.$ShowExternalValidationErrors(jqXHR.responseJSON.validationErrors);
      } else if (!jqXHR.responseJSON || jqXHR.responseJSON.status === 404 || jqXHR.responseJSON.status === 500 || jqXHR.responseJSON.status === 502 || jqXHR.responseJSON.status === 503) {
        var validationErrors = [{
          "field": that.currentTarget.dataset.origname.replace("root", "configuration"),
          "message": (jqXHR.responseJSON && jqXHR.responseJSON.info) || jqXHR.statusText
        }];
        that.$ExecuteEditorEvents(false, validationErrors);
        that.$ShowExternalValidationErrors(validationErrors);
      }
    });
  };

  function ExecuteEditorEvents(isValid, errors) {
    var index = this.errors.indexOf("ExternalValidationUrl");
    this.errors.splice(index, 1);
    this.Dictionary.asyncValidation = false;

    if (errors && errors.length) {
      errors.forEach(function(item) {
        var itemspath = item.field.replace("configuration", "root");
        var element = this.element.querySelector("[data-origname='" + itemspath + "']");
        UtilClass.$ToggleError(isValid, element, this.errors);
      }.bind(this));
    }

    if (this.$Digest)
      this.$Digest();

  }

  function ShowExternalValidationSuccess(message) {
    this.editor.externalvalidationurl.forEach(function(dictionaryPath) {
      var Dictionary = this.editor.Dictionary[dictionaryPath];
      var displayMessage = Dictionary.value || Dictionary.value === 0 ? true : false;


      this.$DisableExternalValidationElements(dictionaryPath, false, message, "#819f01", displayMessage);

    }.bind(this))
  }

  function ShowExternalValidationErrors(errors) {
    this.editor.externalvalidationurl.forEach(function(dictionaryPath) {
      var configuration = dictionaryPath.replace("root", "configuration");

      var error = errors.filter(function(error) {
        return error.field === configuration;
      })

      if (error && error.length) {
        this.$DisableExternalValidationElements(dictionaryPath, false, error[0].message, "#e14d43", true);
      } else
        this.$DisableExternalValidationElements(dictionaryPath, false, undefined, undefined, true);

    }.bind(this))
  }

  /**
   * Validation for number fields
   */


  function NumberValidation() {
    ExternalValidationUrl.call(this);
  }

  UtilClass.$Inheritance(NumberValidation, ExternalValidationUrl);

  NumberValidation.prototype.$exclusiveMinimumValidation = exclusiveMinimumValidation;
  NumberValidation.prototype.$inclusiveMinimumValidation = inclusiveMinimumValidation;
  NumberValidation.prototype.$MinimumValidation = MinimumValidation;
  NumberValidation.prototype.$MaximumValidation = MaximumValidation;
  NumberValidation.prototype.$MaxLength = MaxLength;
  NumberValidation.prototype.$MinLength = MinLength;
  NumberValidation.prototype.$MultipleOf = MultipleOf;
  NumberValidation.prototype.$NumberTypeValidation = NumberTypeValidation;

  function NumberTypeValidation(validation) {
    var isValid = !isNaN(this.currentTarget.value);

    // decimals are not allowe for integer types
    if (validation.type === "integer")
      isValid = this.currentTarget.value.indexOf(".") !== -1 ? false : isValid;

    // integer fields are still string in Dictionary which is good
    if (typeof this.Dictionary.value !== "number" && isValid)
      this.Dictionary.value = parseInt(this.currentTarget.value);


    if (isValid) {
      this.currentTarget.value = UtilClass.$sanitize(this.Dictionary.value, this.options.$locale.NUMBER_FORMATS);
    }

    UtilClass.$ToggleIsValid(validation, this.currentTarget, isValid);
  }

  function exclusiveMinimumValidation(validation) {
    var isValid = this.Dictionary.value > this.Dictionary.minimum;
    UtilClass.$ToggleIsValid(validation, this.currentTarget, isValid);
  }

  function inclusiveMinimumValidation(validation) {
    return {
      minimumValue: this.schema.minimum,
      errormsg: "error_minimum_incl"
    }
  }

  function MinimumValidation(validation) {
    UtilClass.$ToggleIsValid(validation, this.currentTarget, !(this.Dictionary.value < this.Dictionary.minimum));
  }

  function MaximumValidation(validation) {
    UtilClass.$ToggleIsValid(validation, this.currentTarget, !(this.Dictionary.value > this.Dictionary.maximum));
  }

  function MaxLength(validation) {
    var isValid = this.Dictionary.value !== undefined && !(this.Dictionary.value.length > validation.maxLength)
    UtilClass.$ToggleIsValid(validation, this.currentTarget, isValid);
  }

  function MinLength(validation) {
    UtilClass.$ToggleIsValid(validation, this.currentTarget, this.Dictionary.value !== undefined && !(this.Dictionary.value.length < validation.minLength));
  }

  function MultipleOf(validation) {
    var isValid = this.Dictionary.multipleOf && (window.math.mod(window.math.bignumber(this.Dictionary.value), window.math.bignumber(this.Dictionary.multipleOf)).equals(0))
    UtilClass.$ToggleIsValid(validation, this.currentTarget, isValid);
  };

  /**f
   * Validation for string fields
   */

  function StringValidation(schema, dictionary) {
    NumberValidation.call(this);
  }

  UtilClass.$Inheritance(StringValidation, NumberValidation);

  StringValidation.prototype.requiredValidation = requiredValidation;
  StringValidation.prototype.patternValidation = patternValidation;
  StringValidation.prototype.emailValidation = emailValidation;

  function requiredValidation(validation, isAnyOf) {
    if (isAnyOf) {
      switch (validation.type) {
        case "equal":
          validation.isValid = this.Dictionary.value === validation.value;
          break;
      }
    } else {
      var isValid = checkedRequiredByType(this.Dictionary);
      UtilClass.$ToggleIsValid(validation, this.currentTarget, isValid);
    }
  }

  function checkedRequiredByType(Dictionary) {
    var isValid;

    if (Dictionary.requiredToggle) {
      if (!Dictionary.isRequired)
        isValid = true;
      else if (Dictionary.isRequired)
        isValid = getValid(Dictionary);
    } else {
      isValid = getValid(Dictionary);
    }
    return isValid;
  }


  function getValid(Dictionary) {
    var value = Dictionary.value;

    if (Dictionary.minimum === 0 && !Dictionary.exclusiveMinimum) {
      return value ? true : false
    }

    if (Dictionary.type === "number" && Dictionary.type === "integer" && Dictionary.minimum !== undefined)
      return value ? true : false;
    else if (Dictionary.type === "boolean")
      return typeof value !== "undefined" ? true : false;
    else
      return value || value === 0 ? true : false;

  }

  function patternValidation(validation) {
    if (this.Dictionary.value || this.Dictionary.value == "") {
      UtilClass.$ToggleIsValid(validation, this.currentTarget, new RegExp(validation.pattern).test(this.Dictionary.value));
    } else {
      UtilClass.$ToggleIsValid(validation, this.currentTarget, false);
    }
  }

  function emailValidation(validation) {
    UtilClass.$ToggleIsValid(validation, this.currentTarget, validation.pattern.test(this.Dictionary.value));
  }

  /**
   * AnyOf Class
   */

  function AnyOf() {
    StringValidation.call(this);
  }

  UtilClass.$Inheritance(AnyOf, StringValidation);

  AnyOf.prototype.$AnyOfValidation = AnyOfValidation;
  AnyOf.prototype.$AnyOfParser = AnyOfParser;

  function AnyOfValidation(validation) {
    validation.isValid = false;

    validation.conditions.forEach(function(childValidation) {
      if (childValidation.type === "emailpattern")
        this.emailValidation(childValidation);
      else if (childValidation.type === "equal")
        this.$AnyOfParser(childValidation, true);
      else if (childValidation.type === "pattern")
        this.patternValidation(childValidation);

      if (childValidation.isValid)
        validation.isValid = true;

    }.bind(this));

    UtilClass.$ToggleIsValid(validation, this.currentTarget, validation.isValid);
  }


  function AnyOfParser(item) {
    if (item.value === "")
      this.requiredValidation(item, true);
  }

  /**
   * ValidationsClass:- Validates the editor
   */


  function ValidationsClass(Dictionary, currentTarget, errors, editor, element, options, Digest) {
    this.Dictionary = Dictionary,
      this.currentTarget = currentTarget,
      this.editor = editor,
      this.errors = errors,
      this.element = element,
      this.options = options,
      this.$Digest = Digest;


    AnyOf.call(this);
  };

  UtilClass.$Inheritance(ValidationsClass, AnyOf);

  ValidationsClass.prototype.$Validate = ValidateEditor;
  ValidationsClass.prototype.$ExecuteValidations = ExecuteValidations;

  return {
    validate: function(Dictionary, currentTarget, errors, editor, element, options, Digest) {
      var validation = new ValidationsClass(Dictionary, currentTarget, errors, editor, element, options, Digest);
      return validation.$Validate();
    }
  };

  function ValidateEditor() {
    this.Dictionary.isValid = true;

    for (var i = 0; i < this.Dictionary.validations.length; i++) {
      if (this.Dictionary.isValid)
        this.$ExecuteValidations(this.Dictionary.validations[i]);
      else
        UtilClass.$ToggleIsValid(this.Dictionary.validations[i], this.currentTarget, true);
    }


    if (this.editor.multipleDependency) {
      var parentPath = this.Dictionary.path.substr(0, this.Dictionary.path.lastIndexOf("."))
      var parentDictionary = this.editor.Dictionary[parentPath];

      var isValid = parentDictionary.display === "block" && this.Dictionary.display === "block" ? this.Dictionary.isValid : true;
      UtilClass.$ToggleError(isValid, this.currentTarget, this.errors);
    } else
      UtilClass.$ToggleError(this.Dictionary.isValid, this.currentTarget, this.errors);
  }

  function ExecuteValidations(validation) {
    switch (validation.type) {
      case 'required':
        this.requiredValidation(validation);
        break;
      case 'pattern':
        this.patternValidation(validation);
        break;
      case 'number':
      case 'integer':
        this.$NumberTypeValidation(validation);
        break;
      case 'emailpattern':
        this.emailValidation(validation);
        break;
      case 'maxLength':
        this.$MaxLength(validation);
        break;
      case 'minLength':
        this.$MinLength(validation);
        break;
      case 'minimum':
        this.$MinimumValidation(validation);
        break;
      case 'maximum':
        this.$MaximumValidation(validation);
        break;
      case 'exclusiveMinimum':
        this.$exclusiveMinimumValidation(validation);
        break;
      case 'anyOf':
        this.$AnyOfValidation(validation);
        break;
      case 'external':
        this.$InitExternalValidation(validation);
        break;
      case 'multipleOf':
        this.$MultipleOf(validation);
        break;
    }

    if (!validation.isValid)
      this.Dictionary.isValid = false;
  };

}, function() {
  /**
   * UtilClass:- consists generic functions
   */

  return {
    $GetWebWorkerBlob: function(webWorkerFile, callback) {
      var scriptStr = "(" + webWorkerFile.toString()  +")()";
      this.$CreateBlobFile(scriptStr, callback);
    },
    $CreateBlobFile: function(scriptStr, callback) {
      window.URL = window.URL || window.webkitURL;
      var blob;
      try {
        blob = new Blob([scriptStr], { type: 'application/javascript' });
      } catch (e) { // Backwards-compatibility
        window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder;
        blob = new BlobBuilder();
        blob.append(scriptStr);
        blob = blob.getBlob();
      }

      if (callback && typeof callback === "function")
        return callback(URL.createObjectURL(blob));
    },
    $ToggleDepenency: function(valueMatched, editor, currentDictionary, dependencyAttr, element, dependencyDictionary) {
      if (valueMatched) {
        if (editor.Dependencies[dependencyAttr].indexOf(currentDictionary.path) === -1 && editor.multipleDependency) {
          editor.Dependencies[dependencyAttr].push(currentDictionary.path);
        }
      } else {
        if (editor.Dependencies[dependencyAttr].indexOf(currentDictionary.path) !== -1 && editor.multipleDependency)
          editor.Dependencies[dependencyAttr].splice(editor.Dependencies[dependencyAttr].indexOf(currentDictionary.path), 1);

        if (!editor.Dependencies[dependencyAttr].length) {
          this.$ToggleHidden("div[data-id='" + dependencyAttr + "']", element, "none", dependencyDictionary);
        }
      }
    },
    $HandleDependency: function(dependency, currentDictionary, UtilClass, ValidationsClass) {
      var dependencyAttr = dependency.depId || dependency.id;

      var element = this.element.querySelector('div[data-id="' + dependencyAttr + '"]'),
        labelElement = $(element).find('.control-label'),
        inputElement = $(element).find('.form-control');

      if (element) {
        var dependencyPath = element.children[0].dataset.schemapath;
        var dependencyDictionary = this.editor.Dictionary[dependencyPath];

        var valueMatched = UtilClass.$TestDependency(currentDictionary, dependency);

        if (valueMatched) {
          if (this.editor.multipleDependency)
            UtilClass.$ToggleDepenency(valueMatched, this.editor, currentDictionary, dependencyAttr, this.element, dependencyDictionary);

          UtilClass.$ToggleHidden("div[data-id='" + dependencyAttr + "']", this.element, "block", dependencyDictionary);
        } else if (!dependency.show) {
          if (this.editor.multipleDependency) {
            UtilClass.$ToggleDepenency(valueMatched, this.editor, currentDictionary, dependencyAttr, this.element, dependencyDictionary);
          } else
            UtilClass.$ToggleHidden("div[data-id='" + dependencyAttr + "']", this.element, "none", dependencyDictionary);
        }

        UtilClass.$RequiredValidation(dependency, valueMatched, labelElement, UtilClass.$TranslateText.bind(this.options.translations), dependencyDictionary);
        UtilClass.$DisableValidation(dependency, valueMatched, inputElement, dependencyDictionary);

        UtilClass.$SetDefaultsToChildElements(dependencyDictionary, inputElement, this, ValidationsClass);
      }
    },
    $SetDefaultsToChildElements: function(dependencyDictionary, inputElement, editor, ValidationsClass) {
      for (var i = 0; i < inputElement.length; i++) {
        var element = inputElement[i];
        var childPaths = element.dataset.origname;
        var childDictionary = this.$GetCurrentDictionary.call(editor, childPaths);

        // setting initialValues to element and Dictionary again
        // if initialValues are not found then using default values
        if (childDictionary.initialValue !== undefined)
          element.value = childDictionary.initialValue;
        else if (!editor.editor.multipleDependency) {
          if (childDictionary.default !== undefined)
            element.value = childDictionary.default;
          else if (childDictionary.type === "string")
            element.value = "";
        }

        if (editor.editor.multipleDependency && !editor.editor.Dependencies[dependencyDictionary.dataID].length) {
          if (childDictionary.default !== undefined)
            element.value = childDictionary.default;
          else if (childDictionary.type === "string")
            element.value = "";
        }


        childDictionary.value = element.value;

        if (childDictionary.validations && childDictionary.validations.length)
          ValidationsClass.validate(childDictionary, element, editor.errors, editor.editor, editor.element, editor.options, editor.$Digest.bind(editor));

        if (element.nodeName === "SELECT" && childDictionary.dependenciesAttribute && element.onchange) {
          editor.busy = true;
          element.onchange({ "currentTarget": element });
          editor.busy = false;
        }
      }
    },
    $RequiredValidation: function(dependency, valueMatched, labelElement, translate, dependencyDictionary) {

      if (dependency.requiredToggle && !valueMatched) {
        dependencyDictionary.isRequired = false;

        var optionalElement = labelElement && labelElement[0] && labelElement[0].querySelector("#isoptional");
        if (optionalElement) {
          optionalElement.textContent = translate('optional', 'Errors');
          optionalElement.style.color = "";
          optionalElement.style.marginLeft = "0";
        }
      } else
      if (dependency.requiredToggle && valueMatched) {
        dependencyDictionary.isRequired = true;

        var optionalElement = labelElement && labelElement[0] && labelElement[0].querySelector("#isoptional");
        if (optionalElement) {
          optionalElement.textContent = "*";
          optionalElement.style.color = "red";
          optionalElement.style.marginLeft = "6px";
        }
      }
    },
    $DisableValidation: function(dependency, valueMatched, inputElement, currentDictionary) {

      if ((dependency.disableToggle && (inputElement.attr('disabled') === false || inputElement.attr('disabled') === undefined)) && !valueMatched) {

        if (!dependency.fullPath || dependency.fullPath.indexOf('.') === -1) {
          if (currentDictionary.type === 'string') {
            inputElement.val('');
            currentDictionary.value = ''
          }
        } else {
          if (currentDictionary.type === 'string') {
            var defaultValue = currentDictionary.default;
            inputElement.val(defaultValue ? defaultValue : '');
            if (currentDictionary.onInputChange) {
              currentDictionary.onInputChange();
            }
            currentDictionary.value = defaultValue ? defaultValue : '';
            if (currentDictionary.change) {
              currentDictionary.change();
            }

          }
        }

        inputElement.attr('disabled', 'disabled');
      } else if ((dependency.disableToggle && inputElement.attr('disabled') === 'disabled') && valueMatched) {
        inputElement.removeAttr('disabled');
      }

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
    $ToggleHidden: function(selector, container, display, currentDictionary) {
      var targetElement = container.querySelector(selector);

      if (targetElement) {
        display === "none" ? $(targetElement).hide(0) : $(targetElement).show(0);
        currentDictionary.display = display;
      } else
        console.log(selector, "--------not found");
    },
    $AddLoader: function(loadingContainerId) {
      if (this.options.loadingClass)
        this.element.querySelector(loadingContainerId).classList.add(this.options.loadingClass);
    },
    $RemoveLoader: function(loadingContainerId) {
      if (this.options.loadingClass)
        this.element.querySelector(loadingContainerId).classList.remove(this.options.loadingClass);
    },
    $on: function(eventName, callback) {
      this[eventName] = callback;
    },
    $Inheritance: function(ParentClass, ChildClass) {
      ParentClass.prototype = Object.create(ChildClass.prototype);
      ParentClass.prototype.constructor = ParentClass;
    },
    $Translations: function() {
      /* 
      * for MNO translation will be from Domworker.$Translations
      * so overriding editor translations with it
      */
      if(DomWorker.$Translations && DomWorker.$Translations.errorTranslations) {
        this.options.translations.errorTranslations = DomWorker.$Translations.errorTranslations;
      }

      if(DomWorker.$Translations && DomWorker.$Translations.productTranslations) {
        this.options.translations.productSchemaTranlations = DomWorker.$Translations.productTranslations;
      }


      return {
        errorTranslations: this.options.translations.errorTranslations || {},
        productSchemaTranlations: this.options.translations.productSchemaTranlations || {},
        keysToTranslate: [{
          key: 'title',
          type: 'string'
        }, {
          key: 'description',
          type: 'string'
        }, {
          key: 'enum_titles',
          type: 'array',
          path: 'options.enum_titles'
        }, {
          key: 'tooltip',
          type: 'string',
          path: 'options.tooltip'
        }]
      }
    },
    $getValue: function() {
      var initialValues = {};

      for (var key in this.editor.Dictionary) {
        if (key === "root")
          continue;

        var element = this.editor.Dictionary[key];

        key = key.split(".").splice(1);
        var count = 0;

        function nextValue(key_, initialValues) {
          if (!initialValues[key_]) {
            if (element.type === "object") {
              initialValues[key_] = {};

              if (count < key.length - 1)
                nextValue(key[++count], initialValues[key_]);
            } else
            if (element.type === "array") {
              initialValues[key_] = [];

              if (count < key.length - 1)
                nextValue(key[++count], initialValues[key_]);

            } else {
              initialValues[key_] = element.value;
            }
          } else {
            nextValue(key[++count], initialValues[key_]);
          }
        }

        nextValue(key[count], initialValues);
      }

      return initialValues;
    },
    $GetCurrentDictionary: function(path) {
      return this.editor.Dictionary[path];
    },
    $ToggleIsValid: function(validation, currentTarget, isValid) {
      validation.isValid = isValid;
      var errorTypeSpan = currentTarget.parentElement.querySelector("#" + validation.type);

      if (errorTypeSpan)
        errorTypeSpan.style.display = isValid ? "none" : "inline";
    },
    $ToggleError: function(isValid, currentTarget, errors) {
      var pathName = currentTarget.dataset.origname;
      var position = errors.indexOf(pathName);

      // remove external validation error when field is empty
      if (currentTarget.dataset && currentTarget.dataset.externalValidation && !currentTarget.disabled)
        currentTarget.parentElement.querySelector(".external").innerText = "";

      if (isValid) {
        this.$HideError(currentTarget);
        if (position !== -1)
          errors.splice(position, 1);

      } else {
        this.$ShowError(currentTarget);
        if (position === -1)
          errors.push(pathName);
      }
    },
    $HideError: function(currentTarget) {
      currentTarget.parentElement.classList.remove("has-error");
    },
    $ShowError: function(currentTarget) {
      currentTarget.parentElement.classList.add("has-error");
    },
    $GetValueFromKey: function(path, object, seperator) {
      var paths = path.split(seperator);

      paths.forEach(function(key) {
        if (object)
          object = object[key];
      });

      return object;
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
    $HandleNumberFields: function(value, numberFormaters, element) {
      if (numberFormaters.DECIMAL_SEP !== ".") {
        return value.replace(numberFormaters.DECIMAL_SEP, '.');
      }

      return value;
    },
    $TranslateText: function(key, whichTranslation) {
      var tranlatedText;
      switch (whichTranslation) {
        case 'Errors':
          tranlatedText = this.errorTranslations[key];
          break;
      }
      return tranlatedText || key;
    }
  };
},function() {
    /**
     * initializeTranslations:- get translation files for webworker
     * files such as product translation and error messages translation
     */

    function TranslationsGetter() {};

    TranslationsGetter.prototype.$init = initializeTranslationsConfig;
    TranslationsGetter.prototype.$urlParsers = urlParsers;
    TranslationsGetter.prototype.$fetchProductTranslation = fetchProductTranslation;
    TranslationsGetter.prototype.$fetchErrorMssgTranslation = fetchErrorMssgTranslation;
    TranslationsGetter.prototype.$cleanUrl = cleanUrl;

    // https: //nimbus-hat.wgcloudconnect.com/language/en-au/productSchemas/product_schema_en_au.json
    function initializeTranslationsConfig(options) {
        if (options === undefined) {
            console.warn('options are not provided for fetching the Schema translation files');
            return;
        }
        if (!options.baseUrl) {
            console.warn('baseUrl is mendatory');
            return;
        }

        if (!options['preferred-lang']) {
            console.warn('preferred language is mendatory');
            return;
        }

        this.baseUrl = this.$cleanUrl(options.baseUrl);
        this.preferredLang = options['preferred-lang'];
        this.fallbackLang = options['fallback-lang'] || 'en-us';

        this.$fetchProductTranslation();
        this.$fetchErrorMssgTranslation();
    }

    /*
     * below function clean the baseUrl 
     * and check for / at last of url
     * if found it removes it otherwise return url
     */
    function cleanUrl(url) {
        var splitURl = url.split('/');

        if (splitURl && splitURl.length && splitURl[splitURl.length - 1] === '') {
            splitURl.pop();
            return splitURl.join('/');
        }

        if (splitURl && splitURl.length && splitURl[splitURl.length - 1] === 'language') {
            return url;
        }
    }


    /*
     * below function creates url for product and error 
     * translation files. Url can be preferred or fallback
     * if found it removes it otherwise return url
     */
    function urlParsers(type, lang) {
        var url;
        switch (type) {
            case 'product':
                url = this.baseUrl + '/' + this[lang] +
                    '/productSchemas/product_schema_' + this[lang] + '.json';
                break;
            case 'error':
                url = this.baseUrl + '/' + this[lang] +
                    '/jsoneditor_messages_' + this[lang] + '.json';
                break;

        }
        return url;
    }

    // below function fetches product translation
    function fetchProductTranslation() {
        var preferredTranslationURL = this.$urlParsers('product', 'preferredLang');
        var fallbackLangURL = this.$urlParsers('product', 'fallbackLang');
        var that = this;

        $q([preferredTranslationURL, fallbackLangURL]).$promise.then(function(translationFile) {
            that.productTranslations = joinFiles(translationFile);
        });
    }

    function joinFiles(translationFile) {
        return $.extend(true, {}, translationFile[0], translationFile[1]);
    }

    // below function fetches error translation
    function fetchErrorMssgTranslation() {
        var preferredTranslationURL = this.$urlParsers('error', 'preferredLang');
        var fallbackLangURL = this.$urlParsers('error', 'fallbackLang');
        var that = this;

        $q([preferredTranslationURL, fallbackLangURL]).$promise.then(function(translationFile) {
            that.errorTranslations = joinFiles(translationFile);
        });
    }

    function $q(urls) {
        var done = urls.length;
        var files = {};

        urls.forEach(function(url) {
            __$http(url, function(translationFile) {
                handleCallback(translationFile);
            }, function(error) {
                handleCallback();
            });
        });

        var resolve = {
            "$promise": {
                "then": then
            },
            callback: ''
        };

        return resolve;

        function then(callback) {
            this.callback = callback;
        }

        function handleCallback(translationFile) {
            done -= 1;
            files[done] = translationFile || {};

            if (done == 0) {
                resolve.$promise.callback(files);
            }
        }
    }

    function __$http(url, successCallback, errorCallback) {
        $.ajax({
            url: url,
            type: 'GET',
            success: successCallback,
            error: errorCallback
        });
    }



    return new TranslationsGetter();
},function(){
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
       self.externalValidationErrors.push(this.Dictionary.path);
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
        };

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
            });
        }

        function $StringTranslation(translationKey, keyToTranslate) {
            return self.Translations.productSchemaTranlations[translationKey] &&
                self.Translations.productSchemaTranlations[translationKey][keyToTranslate] || keyToTranslate;
        }

        function $ArrayTranslation(translationKey, enum_array) {
            if (enum_array && enum_array.length) {
                enum_array.forEach(function(item, index) {
                    enum_array[index] = self.Translations.productSchemaTranlations[translationKey] &&
                        self.Translations.productSchemaTranlations[translationKey][item] || item;
                });
            }
        }

    }

    return translationsClass();
})(); var Getters = (function() {

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

       this.__$Extend__(this.schema, $ref);
     }
   }

   Getters.prototype.__$Extend__ = function(schema, $ref){
      mergeObjects(schema, $ref);

      function mergeObjects(source, target){
         for (var key in target) {
           if (source[key] && typeof source[key] !== "object")
             continue;

           if(!source[key])
             createProperty(source, target, key);

           if(typeof target[key] === "object")
             mergeObjects(source[key], target[key]);
         }
       }


       function createProperty(source, target, key){
          if(target[key] instanceof Array)
            source[key] = [];
          else if(typeof target[key] === "object")
            source[key] = {};
          else
            source[key] = target[key];
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
        "hideDependency": self.hideDependency,
          "externalValidationErrors":self.externalValidationErrors
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
    self.externalValidationErrors=[];
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
});